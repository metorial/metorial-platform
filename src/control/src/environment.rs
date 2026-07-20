use std::{
    collections::BTreeMap,
    env, fs,
    path::{Path, PathBuf},
};

use miette::{IntoDiagnostic, Result, WrapErr, bail};
use percent_encoding::{AsciiSet, CONTROLS, utf8_percent_encode};
use serde_json::Value;
const URL_COMPONENT: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'!')
    .add(b'"')
    .add(b'#')
    .add(b'$')
    .add(b'%')
    .add(b'&')
    .add(b'\'')
    .add(b'(')
    .add(b')')
    .add(b'*')
    .add(b'+')
    .add(b',')
    .add(b'/')
    .add(b':')
    .add(b';')
    .add(b'<')
    .add(b'=')
    .add(b'>')
    .add(b'?')
    .add(b'@')
    .add(b'[')
    .add(b'\\')
    .add(b']')
    .add(b'^')
    .add(b'`')
    .add(b'{')
    .add(b'|')
    .add(b'}');

use crate::{
    manifest::{EnvSpec, EnvValue, LoadedManifest, Mongo, Postgres},
    root::{ProjectRoot, RootKind},
    workspace::{self, WorkspaceRuntime},
};

pub fn root_environment(project: &ProjectRoot) -> Result<BTreeMap<String, String>> {
    let mut output = BTreeMap::new();
    let path = project.root.join("env.json");
    if path.exists() {
        let text = fs::read_to_string(&path)
            .into_diagnostic()
            .wrap_err_with(|| format!("could not read {}", path.display()))?;
        let value: Value = serde_json::from_str(&text)
            .into_diagnostic()
            .wrap_err_with(|| format!("invalid {}", path.display()))?;
        let object = value
            .as_object()
            .ok_or_else(|| miette::miette!("{} must contain a JSON object", path.display()))?;
        flatten_json("", object, &mut output)?;
    }
    output.insert(
        "METORIAL_ENV".into(),
        env::var("METORIAL_ENV").unwrap_or_else(|_| "development".into()),
    );
    output.insert(
        "METORIAL_SOURCE".into(),
        match project.kind {
            RootKind::Enterprise => "enterprise",
            RootKind::Standalone => "oss",
        }
        .into(),
    );
    output.insert(
        "IS_ENTERPRISE".into(),
        matches!(project.kind, RootKind::Enterprise).to_string(),
    );
    let hostname = env::var("METORIAL_HOSTNAME")
        .ok()
        .or_else(|| output.get("METORIAL_HOSTNAME").cloned())
        .unwrap_or_else(|| "localhost".into());
    output.insert("METORIAL_HOSTNAME".into(), hostname);
    output.insert(
        "NODE_ENV".into(),
        env::var("NODE_ENV").unwrap_or_else(|_| "development".into()),
    );
    for (key, value) in [
        ("CONTROL_PORT_POSTGRES", 35432),
        ("CONTROL_PORT_MONGO", 32707),
        ("CONTROL_PORT_REDIS", 36379),
        ("CONTROL_PORT_NATS", 34222),
        ("CONTROL_PORT_ETCD_CLIENT", 32379),
        ("CONTROL_PORT_ETCD_PEER", 32380),
    ] {
        output
            .entry(key.into())
            .or_insert_with(|| value.to_string());
    }
    if let Some(metadata) = workspace::metadata_if_present(&project.root)?
        && metadata.runtime == WorkspaceRuntime::Host
    {
        let ports = metadata
            .service_ports
            .ok_or_else(|| miette::miette!("host workspace metadata is missing service_ports"))?;
        output.insert("METORIAL_HOSTNAME".into(), "localhost".into());
        for (key, value) in [
            ("CONTROL_PORT_POSTGRES", ports.postgres),
            ("CONTROL_PORT_MONGO", ports.mongo),
            ("CONTROL_PORT_REDIS", ports.redis),
            ("CONTROL_PORT_NATS", ports.nats),
            ("CONTROL_PORT_ETCD_CLIENT", ports.etcd_client),
            ("CONTROL_PORT_ETCD_PEER", ports.etcd_peer),
        ] {
            output.insert(key.into(), value.to_string());
        }
    }
    Ok(output)
}

fn flatten_json(
    prefix: &str,
    object: &serde_json::Map<String, Value>,
    output: &mut BTreeMap<String, String>,
) -> Result<()> {
    for (key, value) in object {
        let name = if prefix.is_empty() {
            key.clone()
        } else {
            format!("{prefix}_{key}")
        };
        match value {
            Value::String(value) => {
                output.insert(name, value.clone());
            }
            Value::Number(value) => {
                output.insert(name, value.to_string());
            }
            Value::Bool(value) => {
                output.insert(name, value.to_string());
            }
            Value::Object(value) => flatten_json(&name, value, output)?,
            Value::Null => {}
            _ => bail!("env.json value {name:?} must be scalar or an object"),
        }
    }
    Ok(())
}

pub fn resolve(
    values: &BTreeMap<String, EnvValue>,
    root_values: &BTreeMap<String, String>,
) -> Result<BTreeMap<String, String>> {
    let mut output = BTreeMap::new();
    for (key, value) in values {
        let resolved = match value {
            EnvValue::Literal(value) => Some(value.clone()),
            // A boolean declaration inherits the key when available. This matches the
            // previous env generator, where optional credentials were omitted.
            EnvValue::Lookup(true) => lookup(key, root_values),
            EnvValue::Lookup(false) => unreachable!("manifest validation rejects false"),
            EnvValue::Detailed(spec) => resolve_spec(key, spec, root_values)?,
        };
        if let Some(resolved) = resolved {
            let interpolated = interpolate(&resolved, root_values)?;
            output.insert(
                key.clone(),
                remap_legacy_dependency_ports(&interpolated, root_values),
            );
        }
    }
    Ok(output)
}

fn remap_legacy_dependency_ports(value: &str, root_values: &BTreeMap<String, String>) -> String {
    let mut output = value.to_string();
    for (default, key) in [
        (35432, "CONTROL_PORT_POSTGRES"),
        (32707, "CONTROL_PORT_MONGO"),
        (36379, "CONTROL_PORT_REDIS"),
        (34222, "CONTROL_PORT_NATS"),
        (32379, "CONTROL_PORT_ETCD_CLIENT"),
        (32380, "CONTROL_PORT_ETCD_PEER"),
    ] {
        let Some(port) = root_values.get(key) else {
            continue;
        };
        for host in ["localhost", "127.0.0.1"] {
            output = output.replace(&format!("{host}:{default}"), &format!("{host}:{port}"));
        }
    }
    output
}

fn interpolate(value: &str, root_values: &BTreeMap<String, String>) -> Result<String> {
    let mut output = String::with_capacity(value.len());
    let mut remaining = value;
    while let Some(start) = remaining.find("{{") {
        output.push_str(&remaining[..start]);
        remaining = &remaining[start + 2..];
        let Some(end) = remaining.find("}}") else {
            bail!("unresolved environment template in {value:?}");
        };
        let template = &remaining[..end];
        let key = match template {
            "HOSTNAME" => "METORIAL_HOSTNAME",
            "CONTROL_PORT_POSTGRES"
            | "CONTROL_PORT_MONGO"
            | "CONTROL_PORT_REDIS"
            | "CONTROL_PORT_NATS"
            | "CONTROL_PORT_ETCD_CLIENT"
            | "CONTROL_PORT_ETCD_PEER" => template,
            _ => bail!("unknown environment template {template:?} in {value:?}"),
        };
        let resolved = lookup(key, root_values)
            .ok_or_else(|| miette::miette!("environment template {template} is unresolved"))?;
        output.push_str(&resolved);
        remaining = &remaining[end + 2..];
    }
    output.push_str(remaining);
    if output.contains("{{") {
        bail!("unresolved environment template in {value:?}");
    }
    Ok(output)
}

fn resolve_spec(
    key: &str,
    spec: &EnvSpec,
    root_values: &BTreeMap<String, String>,
) -> Result<Option<String>> {
    if let Some(value) = &spec.value {
        return Ok(Some(value.clone()));
    }
    let source = spec.from.as_deref().unwrap_or(key);
    if let Some(value) = lookup(source, root_values) {
        return Ok(Some(value));
    }
    if let Some(value) = &spec.default {
        return Ok(Some(value.clone()));
    }
    if spec.required {
        bail!("required environment variable {source} is missing");
    }
    Ok(None)
}

fn lookup(key: &str, root_values: &BTreeMap<String, String>) -> Option<String> {
    root_values.get(key).cloned().or_else(|| env::var(key).ok())
}

pub fn all_for_manifest(
    loaded: &LoadedManifest,
    root_values: &BTreeMap<String, String>,
) -> Result<BTreeMap<String, String>> {
    let mut output = resolve(&loaded.manifest.env, root_values)?;
    for key in [
        "METORIAL_ENV",
        "METORIAL_SOURCE",
        "IS_ENTERPRISE",
        "METORIAL_HOSTNAME",
        "NODE_ENV",
    ] {
        if let Some(value) = root_values.get(key) {
            output.insert(key.into(), value.clone());
        }
    }
    for (name, db) in &loaded.manifest.postgres {
        output.insert(name.clone(), postgres_url(db));
    }
    for (name, db) in &loaded.manifest.mongo {
        output.insert(name.clone(), mongo_url(db));
    }
    Ok(output)
}

pub fn has_values(loaded: &LoadedManifest) -> bool {
    !loaded.manifest.env.is_empty()
        || !loaded.manifest.postgres.is_empty()
        || !loaded.manifest.mongo.is_empty()
}

pub fn write_for_manifest(
    loaded: &LoadedManifest,
    root_values: &BTreeMap<String, String>,
) -> Result<PathBuf> {
    let directory = loaded
        .path
        .parent()
        .ok_or_else(|| miette::miette!("{} has no parent directory", loaded.path.display()))?;
    let path = directory.join(".env");
    let temporary = directory.join(".env.control.tmp");
    let values = all_for_manifest(loaded, root_values)?;
    write_dotenv(&temporary, &values)?;
    if path.exists() {
        fs::remove_file(&path)
            .into_diagnostic()
            .wrap_err_with(|| format!("could not replace {}", path.display()))?;
    }
    fs::rename(&temporary, &path)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not install {}", path.display()))?;
    Ok(path)
}

pub fn write_dotenv(path: &Path, values: &BTreeMap<String, String>) -> Result<()> {
    let mut contents = values
        .iter()
        .map(|(key, value)| format!("{key}={}", format_dotenv_value(value)))
        .collect::<Vec<_>>()
        .join("\n");
    contents.push('\n');
    fs::write(path, contents)
        .into_diagnostic()
        .wrap_err_with(|| format!("could not write {}", path.display()))
}

fn format_dotenv_value(value: &str) -> String {
    // Bun's `--env-file` does not unescape `\"` inside double-quoted values, so
    // JSON (and anything else with `"`) must use single quotes to round-trip.
    let needs_quotes = value.is_empty()
        || value.bytes().any(|byte| {
            matches!(
                byte,
                b' ' | b'\t' | b'\n' | b'\r' | b'#' | b'=' | b'"' | b'\'' | b'`' | b'$'
            )
        });
    if !needs_quotes {
        return value.to_string();
    }
    if !value.contains('\'') && !value.contains('\n') && !value.contains('\r') {
        return format!("'{value}'");
    }
    format!("\"{}\"", escape_dotenv(value))
}

fn escape_dotenv(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\r', "\\r")
        .replace('\n', "\\n")
}

fn encode(value: &str) -> String {
    utf8_percent_encode(value, URL_COMPONENT).to_string()
}

pub fn postgres_url(db: &Postgres) -> String {
    format!(
        "postgresql://{}:{}@{}:{}/{}",
        encode(&db.user),
        encode(&db.password),
        db.host,
        db.port,
        encode(&db.database)
    )
}

pub fn mongo_url(db: &Mongo) -> String {
    let auth = match (&db.user, &db.password) {
        (Some(user), Some(password)) => format!("{}:{}@", encode(user), encode(password)),
        (Some(user), None) => format!("{}@", encode(user)),
        _ => String::new(),
    };
    let query = db
        .auth_source
        .as_ref()
        .map(|source| format!("?authSource={}", encode(source)))
        .unwrap_or_default();
    format!(
        "mongodb://{auth}{}:{}/{}{query}",
        db.host,
        db.port,
        encode(&db.database)
    )
}

#[cfg(test)]
mod tests {
    use std::fs;

    use tempfile::tempdir;

    use super::*;
    use crate::manifest::load;

    #[test]
    fn generates_encoded_database_urls() {
        let pg = Postgres {
            host: "localhost".into(),
            port: 5432,
            user: "user".into(),
            password: "a b".into(),
            database: "my-db".into(),
            service: None,
            compose: None,
        };
        assert_eq!(
            postgres_url(&pg),
            "postgresql://user:a%20b@localhost:5432/my-db"
        );
    }

    #[test]
    fn writes_dotenv_without_requiring_missing_optional_lookups() {
        let temp = tempdir().unwrap();
        fs::write(temp.path().join("package.json"), "{}").unwrap();
        fs::write(
            temp.path().join("control.toml"),
            "name='example'\n[dev.env]\nLITERAL='a\"b'\nOPTIONAL=true",
        )
        .unwrap();
        let loaded = load(&temp.path().join("control.toml")).unwrap();
        let path = write_for_manifest(&loaded, &BTreeMap::new()).unwrap();
        assert_eq!(fs::read_to_string(path).unwrap(), "LITERAL='a\"b'\n");
    }

    #[test]
    fn writes_json_env_values_with_single_quotes_for_bun() {
        let json = r#"{"local1":{"federationApi":"http://localhost:4321"}}"#;
        let values = BTreeMap::from([("VITE_FEDERATION_INSTANCES".into(), json.into())]);
        let temp = tempdir().unwrap();
        let path = temp.path().join(".env");
        write_dotenv(&path, &values).unwrap();
        assert_eq!(
            fs::read_to_string(path).unwrap(),
            format!("VITE_FEDERATION_INSTANCES='{json}'\n")
        );
    }

    #[test]
    fn interpolates_hostname_after_resolving_every_env_value_form() {
        let values = BTreeMap::from([
            (
                "LITERAL".into(),
                EnvValue::Literal("https://{{HOSTNAME}}:4310".into()),
            ),
            (
                "VALUE".into(),
                EnvValue::Detailed(EnvSpec {
                    value: Some("https://{{HOSTNAME}}:4318".into()),
                    from: None,
                    default: None,
                    required: false,
                }),
            ),
            (
                "DEFAULT".into(),
                EnvValue::Detailed(EnvSpec {
                    value: None,
                    from: Some("MISSING".into()),
                    default: Some("https://{{HOSTNAME}}:4300".into()),
                    required: false,
                }),
            ),
            (
                "FROM".into(),
                EnvValue::Detailed(EnvSpec {
                    value: None,
                    from: Some("SOURCE".into()),
                    default: None,
                    required: true,
                }),
            ),
            (
                "JSON".into(),
                EnvValue::Literal(r#"{"nested":{"host":"{{HOSTNAME}}"}}"#.into()),
            ),
        ]);
        let roots = BTreeMap::from([
            ("METORIAL_HOSTNAME".into(), "dev.example.test".into()),
            ("SOURCE".into(), "https://{{HOSTNAME}}:4321".into()),
        ]);

        let resolved = resolve(&values, &roots).unwrap();
        assert_eq!(resolved["LITERAL"], "https://dev.example.test:4310");
        assert_eq!(resolved["VALUE"], "https://dev.example.test:4318");
        assert_eq!(resolved["DEFAULT"], "https://dev.example.test:4300");
        assert_eq!(resolved["FROM"], "https://dev.example.test:4321");
        assert_eq!(
            resolved["JSON"],
            r#"{"nested":{"host":"dev.example.test"}}"#
        );
    }

    #[test]
    fn rejects_unknown_and_unresolved_templates() {
        let roots = BTreeMap::from([("METORIAL_HOSTNAME".into(), "localhost".into())]);
        for value in ["https://{{UNKNOWN}}:4310", "https://{{HOSTNAME:4310"] {
            let values = BTreeMap::from([("URL".into(), EnvValue::Literal(value.to_string()))]);
            assert!(resolve(&values, &roots).is_err(), "{value}");
        }

        let values = BTreeMap::from([(
            "URL".into(),
            EnvValue::Literal("https://{{HOSTNAME}}:4310".into()),
        )]);
        assert!(resolve(&values, &BTreeMap::new()).is_err());
    }

    #[test]
    fn interpolates_named_dependency_ports() {
        let values = BTreeMap::from([(
            "REDIS_URL".into(),
            EnvValue::Literal("redis://localhost:{{CONTROL_PORT_REDIS}}/0".into()),
        )]);
        let roots = BTreeMap::from([("CONTROL_PORT_REDIS".into(), "45678".into())]);
        assert_eq!(
            resolve(&values, &roots).unwrap()["REDIS_URL"],
            "redis://localhost:45678/0"
        );
    }

    #[test]
    fn remaps_legacy_local_dependency_urls_for_host_workspaces() {
        let values = BTreeMap::from([
            (
                "DATABASE_URL".into(),
                EnvValue::Literal("postgresql://postgres@127.0.0.1:35432/app".into()),
            ),
            (
                "REDIS_URL".into(),
                EnvValue::Literal("redis://localhost:36379/0".into()),
            ),
        ]);
        let roots = BTreeMap::from([
            ("CONTROL_PORT_POSTGRES".into(), "41001".into()),
            ("CONTROL_PORT_REDIS".into(), "41003".into()),
        ]);
        let resolved = resolve(&values, &roots).unwrap();
        assert_eq!(
            resolved["DATABASE_URL"],
            "postgresql://postgres@127.0.0.1:41001/app"
        );
        assert_eq!(resolved["REDIS_URL"], "redis://localhost:41003/0");
    }

    #[test]
    fn host_workspaces_always_use_localhost() {
        let temp = tempdir().unwrap();
        fs::create_dir_all(temp.path().join(".control")).unwrap();
        fs::write(
            temp.path().join(".control/workspace.json"),
            r#"{
                "id": "feature-auth",
                "hostname": "feature-auth.localhost",
                "branch": "feature/auth",
                "source_root": "/code/metorial",
                "runtime": "host",
                "service_ports": {
                    "postgres": 41001,
                    "mongo": 41002,
                    "redis": 41003,
                    "nats": 41004,
                    "etcd_client": 41005,
                    "etcd_peer": 41006
                }
            }"#,
        )
        .unwrap();
        let project = ProjectRoot {
            kind: RootKind::Standalone,
            root: temp.path().into(),
            oss: temp.path().into(),
        };
        assert_eq!(
            root_environment(&project).unwrap()["METORIAL_HOSTNAME"],
            "localhost"
        );
    }
}
