use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::UNIX_EPOCH;
use tauri::{Manager, PhysicalPosition, PhysicalSize, Position, Size, Window, WindowEvent};
use walkdir::WalkDir;

#[derive(Debug, Clone)]
struct SkillSourceDef {
    tool: &'static str,
    root_path: PathBuf,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SkillSummary {
    id: String,
    name: String,
    description: String,
    version: Option<String>,
    tool: String,
    path: String,
    relative_path: String,
    source_root: String,
    modified_unix: Option<u64>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SkillSourceSummary {
    tool: String,
    root_path: String,
    exists: bool,
    skill_count: usize,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ListSkillsResponse {
    skills: Vec<SkillSummary>,
    sources: Vec<SkillSourceSummary>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct SkillDetail {
    path: String,
    content: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct UpdateResult {
    target: String,
    repo_root: Option<String>,
    updated: bool,
    message: String,
    output: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedWindowState {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
    maximized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PersistedCollectionItem {
    id: String,
    name: String,
    icon: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct PersistedAppState {
    favorites: Vec<String>,
    collections: Vec<PersistedCollectionItem>,
    skill_collections: HashMap<String, String>,
}

fn window_state_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let config_dir = app.path().app_config_dir().ok()?;
    Some(config_dir.join("window-state.json"))
}

fn app_state_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let config_dir = app.path().app_config_dir().ok()?;
    Some(config_dir.join("user-state.json"))
}

fn read_window_state(path: &Path) -> Option<PersistedWindowState> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_window_state(path: &Path, state: &PersistedWindowState) {
    let Some(parent) = path.parent() else {
        return;
    };

    if fs::create_dir_all(parent).is_err() {
        return;
    }

    if let Ok(raw) = serde_json::to_string(state) {
        let _ = fs::write(path, raw);
    }
}

fn read_app_state(path: &Path) -> Option<PersistedAppState> {
    let raw = fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

fn write_app_state(path: &Path, state: &PersistedAppState) -> Result<(), String> {
    let Some(parent) = path.parent() else {
        return Err("invalid app state path".to_string());
    };

    fs::create_dir_all(parent)
        .map_err(|err| format!("failed to create app state directory {}: {}", parent.to_string_lossy(), err))?;

    let raw = serde_json::to_string(state).map_err(|err| format!("failed to serialize app state: {}", err))?;
    fs::write(path, raw).map_err(|err| format!("failed to write app state {}: {}", path.to_string_lossy(), err))
}

fn snapshot_window_state(window: &Window) -> Option<PersistedWindowState> {
    let state_path = window_state_path(&window.app_handle())?;
    let is_maximized = window.is_maximized().ok().unwrap_or(false);

    if is_maximized {
        let mut previous_state = read_window_state(&state_path).unwrap_or(PersistedWindowState {
            x: 0,
            y: 0,
            width: 1040,
            height: 680,
            maximized: true,
        });
        previous_state.maximized = true;
        return Some(previous_state);
    }

    let position = window.outer_position().ok()?;
    let size = window.outer_size().ok()?;

    Some(PersistedWindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized: false,
    })
}

fn persist_window_state(window: &Window) {
    let Some(state_path) = window_state_path(&window.app_handle()) else {
        return;
    };
    let Some(state) = snapshot_window_state(window) else {
        return;
    };

    write_window_state(&state_path, &state);
}

fn restore_window_state(window: &Window) {
    let Some(state_path) = window_state_path(&window.app_handle()) else {
        return;
    };
    let Some(state) = read_window_state(&state_path) else {
        return;
    };

    let _ = window.set_size(Size::Physical(PhysicalSize::new(state.width, state.height)));
    let _ = window.set_position(Position::Physical(PhysicalPosition::new(state.x, state.y)));

    if state.maximized {
        let _ = window.maximize();
    }
}

fn build_source_defs() -> Vec<SkillSourceDef> {
    let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let mut defs = vec![];

    if let Ok(home) = env::var("HOME") {
        let home_path = PathBuf::from(home);
        defs.push(SkillSourceDef {
            tool: "Codex",
            root_path: home_path.join(".codex/skills"),
        });
        defs.push(SkillSourceDef {
            tool: "Agents",
            root_path: home_path.join(".agents/skills"),
        });
        defs.push(SkillSourceDef {
            tool: "Claude Code",
            root_path: home_path.join(".claude/skills"),
        });
        defs.push(SkillSourceDef {
            tool: "Cursor",
            root_path: home_path.join(".cursor/skills"),
        });
        defs.push(SkillSourceDef {
            tool: "Windsurf",
            root_path: home_path.join(".windsurf/skills"),
        });
        defs.push(SkillSourceDef {
            tool: "Continue",
            root_path: home_path.join(".continue/skills"),
        });
    }

    if let Ok(codex_home) = env::var("CODEX_HOME") {
        defs.push(SkillSourceDef {
            tool: "Codex (CODEX_HOME)",
            root_path: PathBuf::from(codex_home).join("skills"),
        });
    }

    defs.push(SkillSourceDef {
        tool: "Project .claude",
        root_path: cwd.join(".claude/skills"),
    });
    defs.push(SkillSourceDef {
        tool: "Project .codex",
        root_path: cwd.join(".codex/skills"),
    });
    defs.push(SkillSourceDef {
        tool: "Project .agents",
        root_path: cwd.join(".agents/skills"),
    });

    let mut seen = HashSet::new();
    defs.into_iter()
        .filter(|d| seen.insert(d.root_path.clone()))
        .collect()
}

fn parse_frontmatter(content: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();
    let mut lines = content.lines();
    if lines.next().map(|line| line.trim()) != Some("---") {
        return map;
    }

    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" {
            break;
        }
        if let Some((k, v)) = trimmed.split_once(':') {
            let key = k.trim().to_lowercase();
            let value = v.trim().trim_matches('"').trim_matches('\'').to_string();
            if !key.is_empty() && !value.is_empty() {
                map.insert(key, value);
            }
        }
    }
    map
}

fn first_non_empty_line(content: &str) -> Option<String> {
    content
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty() && !line.starts_with('#'))
        .map(ToString::to_string)
}

fn skill_name_from_path(skill_file: &Path) -> String {
    skill_file
        .parent()
        .and_then(|dir| dir.file_name())
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| "Unnamed Skill".to_string())
}

fn path_matches_root(path: &Path, root: &Path) -> bool {
    if path.starts_with(root) {
        return true;
    }

    fs::canonicalize(root)
        .map(|canonical_root| path.starts_with(canonical_root))
        .unwrap_or(false)
}

fn classify_tool_for_skill_path(path: &Path, default_tool: &str) -> String {
    let resolved = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());

    if let Ok(cwd) = env::current_dir() {
        let project_roots = [
            ("Project .claude", cwd.join(".claude")),
            ("Project .codex", cwd.join(".codex")),
            ("Project .agents", cwd.join(".agents")),
        ];
        for (tool, prefix) in project_roots {
            if path_matches_root(&resolved, &prefix) {
                return tool.to_string();
            }
        }
    }

    if let Ok(codex_home) = env::var("CODEX_HOME") {
        let codex_home_path = PathBuf::from(codex_home);
        if path_matches_root(&resolved, &codex_home_path) {
            return "Codex (CODEX_HOME)".to_string();
        }
    }

    if let Ok(home) = env::var("HOME") {
        let home_path = PathBuf::from(home);
        let home_roots = [
            ("Codex", home_path.join(".codex")),
            ("Agents", home_path.join(".agents")),
            ("Claude Code", home_path.join(".claude")),
            ("Cursor", home_path.join(".cursor")),
            ("Windsurf", home_path.join(".windsurf")),
            ("Continue", home_path.join(".continue")),
        ];
        for (tool, prefix) in home_roots {
            if path_matches_root(&resolved, &prefix) {
                return tool.to_string();
            }
        }
    }

    default_tool.to_string()
}

fn collect_skills_from_source(
    source: &SkillSourceDef,
) -> Result<(Vec<SkillSummary>, SkillSourceSummary), String> {
    let root = &source.root_path;
    let root_display = root.to_string_lossy().to_string();

    if !root.exists() {
        return Ok((
            vec![],
            SkillSourceSummary {
                tool: source.tool.to_string(),
                root_path: root_display,
                exists: false,
                skill_count: 0,
            },
        ));
    }

    let mut skills = vec![];
    for entry in WalkDir::new(root)
        .follow_links(true)
        .into_iter()
        .filter_map(Result::ok)
    {
        if !entry.file_type().is_file() {
            continue;
        }
        if entry.file_name().to_string_lossy() != "SKILL.md" {
            continue;
        }

        let path = entry.path().to_path_buf();
        let content = fs::read_to_string(&path)
            .map_err(|err| format!("failed to read {}: {}", path.to_string_lossy(), err))?;
        let frontmatter = parse_frontmatter(&content);

        let name = frontmatter
            .get("name")
            .cloned()
            .unwrap_or_else(|| skill_name_from_path(&path));
        let description = frontmatter
            .get("description")
            .cloned()
            .or_else(|| first_non_empty_line(&content))
            .unwrap_or_else(|| "No description".to_string());
        let version = frontmatter.get("version").cloned();
        let relative_path = path
            .strip_prefix(root)
            .unwrap_or(path.as_path())
            .to_string_lossy()
            .to_string();
        let modified_unix = fs::metadata(&path)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|m| m.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs());

        let path_string = path.to_string_lossy().to_string();
        let tool = classify_tool_for_skill_path(&path, source.tool);
        let id = format!("{}::{}", tool, relative_path);

        skills.push(SkillSummary {
            id,
            name,
            description,
            version,
            tool,
            path: path_string,
            relative_path,
            source_root: root_display.clone(),
            modified_unix,
        });
    }

    skills.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));

    let source_summary = SkillSourceSummary {
        tool: source.tool.to_string(),
        root_path: root_display,
        exists: true,
        skill_count: skills.len(),
    };
    Ok((skills, source_summary))
}

fn run_git_command(repo_root: &Path, args: &[&str]) -> Result<std::process::Output, String> {
    Command::new("git")
        .arg("-C")
        .arg(repo_root)
        .args(args)
        .output()
        .map_err(|err| format!("failed to run git {:?}: {}", args, err))
}

fn resolve_git_repo_root(start_path: &Path) -> Option<PathBuf> {
    let output = Command::new("git")
        .arg("-C")
        .arg(start_path)
        .args(["rev-parse", "--show-toplevel"])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if stdout.is_empty() {
        None
    } else {
        Some(PathBuf::from(stdout))
    }
}

fn update_repo(repo_root: &Path, target: &str) -> Result<UpdateResult, String> {
    let output = run_git_command(repo_root, &["pull", "--ff-only"])?;
    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let combined = format!("{}{}", stdout, stderr).trim().to_string();

    if output.status.success() {
        let is_up_to_date = combined.contains("Already up to date.")
            || combined.contains("Already up-to-date.")
            || combined.contains("Already up to date");
        Ok(UpdateResult {
            target: target.to_string(),
            repo_root: Some(repo_root.to_string_lossy().to_string()),
            updated: !is_up_to_date,
            message: if is_up_to_date {
                "Already up to date".to_string()
            } else {
                "Update completed".to_string()
            },
            output: combined,
        })
    } else {
        Ok(UpdateResult {
            target: target.to_string(),
            repo_root: Some(repo_root.to_string_lossy().to_string()),
            updated: false,
            message: "Update failed".to_string(),
            output: combined,
        })
    }
}

#[tauri::command]
fn load_app_state(app: tauri::AppHandle) -> Result<PersistedAppState, String> {
    let Some(path) = app_state_path(&app) else {
        return Ok(PersistedAppState::default());
    };

    Ok(read_app_state(&path).unwrap_or_default())
}

#[tauri::command]
fn save_app_state(app: tauri::AppHandle, state: PersistedAppState) -> Result<(), String> {
    let Some(path) = app_state_path(&app) else {
        return Err("failed to resolve app state path".to_string());
    };

    write_app_state(&path, &state)
}

#[tauri::command]
fn list_skills() -> Result<ListSkillsResponse, String> {
    let source_defs = build_source_defs();
    let mut all_skills = vec![];
    let mut sources = vec![];

    for source in source_defs {
        let (mut skills, source_summary) = collect_skills_from_source(&source)?;
        all_skills.append(&mut skills);
        sources.push(source_summary);
    }

    all_skills.sort_by(|a, b| {
        a.tool
            .to_lowercase()
            .cmp(&b.tool.to_lowercase())
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(ListSkillsResponse {
        skills: all_skills,
        sources,
    })
}

#[tauri::command]
fn read_skill(path: String) -> Result<SkillDetail, String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("skill file does not exist: {}", path));
    }
    let content = fs::read_to_string(&target)
        .map_err(|err| format!("failed to read {}: {}", target.to_string_lossy(), err))?;
    Ok(SkillDetail { path, content })
}

#[tauri::command]
fn save_skill(path: String, content: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if target.file_name().and_then(|f| f.to_str()) != Some("SKILL.md") {
        return Err("only SKILL.md is editable in this tool".to_string());
    }
    if !target.exists() {
        return Err(format!(
            "target file not found: {}",
            target.to_string_lossy()
        ));
    }
    fs::write(&target, content)
        .map_err(|err| format!("failed to write {}: {}", target.to_string_lossy(), err))
}

fn sanitize_skill_dir_name(name: &str) -> String {
    let mut out = String::with_capacity(name.len());
    let mut last_dash = false;
    for ch in name.trim().chars() {
        let mapped = if ch.is_ascii_alphanumeric() {
            ch.to_ascii_lowercase()
        } else if ch.is_whitespace() || ch == '-' || ch == '_' || ch == '.' {
            '-'
        } else {
            continue;
        };
        if mapped == '-' {
            if last_dash {
                continue;
            }
            last_dash = true;
            out.push(mapped);
        } else {
            last_dash = false;
            out.push(mapped);
        }
    }
    let cleaned = out.trim_matches('-').to_string();
    if cleaned.is_empty() {
        "new-skill".to_string()
    } else {
        cleaned
    }
}

#[tauri::command]
fn create_skill(name: String, description: Option<String>) -> Result<String, String> {
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return Err("skill name cannot be empty".to_string());
    }

    let cwd = env::current_dir().map_err(|err| format!("failed to resolve current dir: {}", err))?;
    let skills_root = cwd.join(".codex/skills");
    fs::create_dir_all(&skills_root).map_err(|err| {
        format!(
            "failed to create skills directory {}: {}",
            skills_root.to_string_lossy(),
            err
        )
    })?;

    let base = sanitize_skill_dir_name(trimmed_name);
    let mut candidate = skills_root.join(&base);
    let mut n = 2_u32;
    while candidate.exists() {
        candidate = skills_root.join(format!("{}-{}", base, n));
        n += 1;
    }

    fs::create_dir_all(&candidate).map_err(|err| {
        format!(
            "failed to create skill directory {}: {}",
            candidate.to_string_lossy(),
            err
        )
    })?;

    let skill_file = candidate.join("SKILL.md");
    let desc = description
        .unwrap_or_default()
        .trim()
        .replace('\n', " ")
        .replace('"', "'");
    let frontmatter_desc = if desc.is_empty() {
        "TODO: add description".to_string()
    } else {
        desc.clone()
    };
    let body_desc = if desc.is_empty() {
        "Describe what this skill should do.".to_string()
    } else {
        desc
    };

    let content = format!(
        "---\nname: \"{}\"\ndescription: \"{}\"\nversion: \"0.1.0\"\n---\n\n# {}\n\n{}\n",
        trimmed_name.replace('"', "'"),
        frontmatter_desc,
        trimmed_name,
        body_desc
    );

    fs::write(&skill_file, content)
        .map_err(|err| format!("failed to write {}: {}", skill_file.to_string_lossy(), err))?;

    Ok(skill_file.to_string_lossy().to_string())
}

#[tauri::command]
fn delete_skill(path: String) -> Result<(), String> {
    let target = PathBuf::from(&path);
    if target.file_name().and_then(|f| f.to_str()) != Some("SKILL.md") {
        return Err("only SKILL.md can be deleted in this tool".to_string());
    }
    if !target.exists() {
        return Err(format!(
            "target file not found: {}",
            target.to_string_lossy()
        ));
    }
    fs::remove_file(&target)
        .map_err(|err| format!("failed to delete {}: {}", target.to_string_lossy(), err))?;

    if let Some(parent) = target.parent() {
        match fs::remove_dir(parent) {
            Ok(()) => {}
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => {}
            Err(err) if err.kind() == std::io::ErrorKind::DirectoryNotEmpty => {}
            Err(err) => {
                return Err(format!(
                    "deleted skill file but failed to remove empty directory {}: {}",
                    parent.to_string_lossy(),
                    err
                ))
            }
        }
    }

    Ok(())
}

#[tauri::command]
fn update_skill(path: String) -> Result<UpdateResult, String> {
    let target = PathBuf::from(&path);
    if !target.exists() {
        return Err(format!("path does not exist: {}", target.to_string_lossy()));
    }
    let start = if target.is_file() {
        target
            .parent()
            .map(Path::to_path_buf)
            .ok_or_else(|| "invalid file path".to_string())?
    } else {
        target
    };
    let repo_root = resolve_git_repo_root(&start);
    if let Some(repo_root) = repo_root {
        update_repo(&repo_root, &path)
    } else {
        Ok(UpdateResult {
            target: path,
            repo_root: None,
            updated: false,
            message: "Not a git-managed skill path".to_string(),
            output: "No git repository was found for this skill.".to_string(),
        })
    }
}

#[tauri::command]
fn update_all_skills() -> Result<Vec<UpdateResult>, String> {
    let skills_response = list_skills()?;
    let mut seen_repo_roots = HashSet::new();
    let mut updates = vec![];

    for skill in skills_response.skills {
        let skill_path = PathBuf::from(&skill.path);
        let Some(parent) = skill_path.parent() else {
            continue;
        };
        let Some(repo_root) = resolve_git_repo_root(parent) else {
            continue;
        };
        if !seen_repo_roots.insert(repo_root.clone()) {
            continue;
        }
        updates.push(update_repo(&repo_root, &repo_root.to_string_lossy())?);
    }

    if updates.is_empty() {
        updates.push(UpdateResult {
            target: "all".to_string(),
            repo_root: None,
            updated: false,
            message: "No git-managed skill sources found".to_string(),
            output: "No skill source with a git repository was detected.".to_string(),
        });
    }

    Ok(updates)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                let host_window = window.as_ref().window();
                restore_window_state(&host_window);
                let _ = host_window.show();
                let _ = host_window.set_focus();
            }
            Ok(())
        })
        .on_window_event(|window, event| match event {
            WindowEvent::Moved(_) | WindowEvent::Resized(_) | WindowEvent::CloseRequested { .. } => {
                persist_window_state(window);
            }
            _ => {}
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_app_state,
            save_app_state,
            list_skills,
            read_skill,
            save_skill,
            create_skill,
            delete_skill,
            update_skill,
            update_all_skills
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;
    use std::time::{SystemTime, UNIX_EPOCH};

    static PROCESS_STATE_LOCK: Mutex<()> = Mutex::new(());

    struct TempDirGuard {
        path: PathBuf,
    }

    impl TempDirGuard {
        fn new(prefix: &str) -> Self {
            let suffix = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time before unix epoch")
                .as_nanos();
            let path = env::temp_dir().join(format!("{}-{}-{}", prefix, std::process::id(), suffix));
            fs::create_dir_all(&path).expect("failed to create temp dir");
            Self { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TempDirGuard {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.path);
        }
    }

    #[cfg(unix)]
    fn symlink_dir<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) {
        std::os::unix::fs::symlink(original, link).expect("failed to create symlink");
    }

    #[cfg(windows)]
    fn symlink_dir<P: AsRef<Path>, Q: AsRef<Path>>(original: P, link: Q) {
        std::os::windows::fs::symlink_dir(original, link).expect("failed to create symlink");
    }

    struct EnvVarGuard {
        key: &'static str,
        original: Option<String>,
    }

    impl EnvVarGuard {
        fn set(key: &'static str, value: &Path) -> Self {
            let original = env::var(key).ok();
            unsafe {
                env::set_var(key, value);
            }
            Self { key, original }
        }
    }

    impl Drop for EnvVarGuard {
        fn drop(&mut self) {
            if let Some(value) = &self.original {
                unsafe {
                    env::set_var(self.key, value);
                }
            } else {
                unsafe {
                    env::remove_var(self.key);
                }
            }
        }
    }

    #[test]
    fn collect_skills_from_source_classifies_symlinked_skill_packs_by_real_path() {
        let _process_state_guard = PROCESS_STATE_LOCK.lock().expect("failed to lock process state");
        let temp = TempDirGuard::new("skillskr-symlink-pack");
        let home = temp.path().join("home");
        let workspace = temp.path().join("workspace");
        let root = home.join(".agents/skills");
        let target_skill_dir = home.join(".codex/superpowers/skills/brainstorming");
        let linked_pack = root.join("superpowers");

        fs::create_dir_all(&target_skill_dir).expect("failed to create target skill dir");
        fs::create_dir_all(&root).expect("failed to create root skills dir");
        fs::create_dir_all(&workspace).expect("failed to create workspace dir");
        fs::write(
            target_skill_dir.join("SKILL.md"),
            "---\nname: brainstorming\ndescription: linked skill pack test\n---\n",
        )
        .expect("failed to write skill");
        symlink_dir(home.join(".codex/superpowers/skills"), &linked_pack);

        let previous_dir = env::current_dir().expect("failed to read current dir");
        let _home_guard = EnvVarGuard::set("HOME", &home);
        env::set_current_dir(&workspace).expect("failed to set current dir");

        let source = SkillSourceDef {
            tool: "Agents",
            root_path: root,
        };

        let (skills, summary) = collect_skills_from_source(&source).expect("failed to collect skills");
        env::set_current_dir(previous_dir).expect("failed to restore current dir");

        assert_eq!(summary.skill_count, 1);
        assert_eq!(skills.len(), 1);
        assert_eq!(skills[0].name, "brainstorming");
        assert_eq!(skills[0].tool, "Codex");
        assert_eq!(skills[0].relative_path, "superpowers/brainstorming/SKILL.md");
    }

    #[test]
    fn delete_skill_removes_empty_directory_so_name_can_be_reused() {
        let _process_state_guard = PROCESS_STATE_LOCK.lock().expect("failed to lock process state");
        let temp = TempDirGuard::new("skillskr-delete-recreate");
        let workspace = temp.path().join("workspace");
        fs::create_dir_all(&workspace).expect("failed to create workspace dir");

        let previous_dir = env::current_dir().expect("failed to read current dir");
        env::set_current_dir(&workspace).expect("failed to set current dir");

        let created_path = create_skill("Sample Skill".to_string(), None).expect("failed to create skill");
        delete_skill(created_path.clone()).expect("failed to delete skill");
        let recreated_path = create_skill("Sample Skill".to_string(), None).expect("failed to recreate skill");

        env::set_current_dir(previous_dir).expect("failed to restore current dir");

        assert!(created_path.ends_with("/.codex/skills/sample-skill/SKILL.md"));
        assert_eq!(recreated_path, created_path);
    }
}
