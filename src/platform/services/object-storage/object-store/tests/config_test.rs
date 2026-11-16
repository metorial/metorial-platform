use object_store::config::{BackendConfig, PublicUrlMode};
use object_store::Config;

// Environment variables are process-wide, so all cases run in one test.
#[test]
fn reads_typed_values_from_the_environment() {
    let vars = [
        ("OBJECT_STORE__SERVER__HOST", "0.0.0.0"),
        ("OBJECT_STORE__SERVER__PORT", "8080"),
        ("OBJECT_STORE__SERVER__HEALTH_PORT", "12121"),
        ("OBJECT_STORE__PUBLIC__MODE", "proxy"),
        (
            "OBJECT_STORE__PUBLIC__BASE_URL",
            "https://metorial.example.com/object-storage",
        ),
        (
            "OBJECT_STORE__PUBLIC__SIGNING_SECRET",
            "12345678901234567890123456789012",
        ),
        ("OBJECT_STORE__BACKEND__TYPE", "s3"),
        ("OBJECT_STORE__BACKEND__REGION", "us-east-1"),
        ("OBJECT_STORE__BACKEND__PHYSICAL_BUCKET", "2024"),
        ("OBJECT_STORE__BACKEND__ENDPOINT", "http://seaweedfs:8333"),
        ("OBJECT_STORE__BACKEND__FORCE_PATH_STYLE", "true"),
        ("OBJECT_STORE__BACKEND__CREATE_BUCKET", "true"),
    ];
    for (key, value) in vars {
        std::env::set_var(key, value);
    }

    let config = Config::from_env().expect("configuration parses");

    assert_eq!(config.server.port, 8080);
    assert_eq!(config.server.health_port, 12121);
    assert_eq!(config.public.mode, PublicUrlMode::Proxy);
    assert_eq!(
        config.public.signing_secret.as_deref(),
        Some("12345678901234567890123456789012")
    );
    match config.backend {
        BackendConfig::S3 {
            physical_bucket,
            force_path_style,
            create_bucket,
            ..
        } => {
            assert_eq!(physical_bucket, "2024");
            assert_eq!(force_path_style, Some(true));
            assert!(create_bucket);
        }
        other => panic!("expected the S3 backend, got {other:?}"),
    }

    for (key, _) in vars {
        std::env::remove_var(key);
    }
}
