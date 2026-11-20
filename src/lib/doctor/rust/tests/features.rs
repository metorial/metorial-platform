#[cfg(feature = "axum")]
mod axum_router {
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use http_body_util::BodyExt;
    use lowerdeck_doctor::{
        axum::router, parse_report, Category, Check, Doctor, Options, Outcome, Severity,
    };
    use tower::ServiceExt;

    fn doctor() -> Doctor {
        let doctor = Doctor::new(Options::new("test"));
        doctor
            .register(Check::new(
                "ok",
                "OK",
                Category::Runtime,
                Severity::Info,
                |_| async { Ok(Outcome::pass("OK")) },
            ))
            .unwrap();
        doctor
    }

    #[tokio::test]
    async fn serves_reports() {
        let response = router(doctor())
            .oneshot(Request::get("/doctor?fresh=1").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::OK);
        assert_eq!(response.headers()["x-metorial-doctor"], "1");
        assert_eq!(response.headers()["cache-control"], "no-store");

        let body = response.into_body().collect().await.unwrap().to_bytes();
        assert_eq!(parse_report(&body).unwrap().checks[0].id, "ok");
    }

    #[tokio::test]
    async fn rejects_other_methods() {
        let response = router(doctor())
            .oneshot(Request::post("/doctor").body(Body::empty()).unwrap())
            .await
            .unwrap();

        assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
        assert_eq!(response.headers()["allow"], "GET");
    }
}

#[cfg(feature = "aws")]
mod aws_errors {
    use aws_smithy_types::error::ErrorMetadata;
    use lowerdeck_doctor::{aws, describe_error, ErrorKind};

    #[test]
    fn classifies_by_error_code() {
        let error = ErrorMetadata::builder()
            .code("AccessDeniedException")
            .message("not authorized to perform kms:Encrypt")
            .build();

        let info = aws::describe_aws_error(&error);
        assert_eq!(
            (info.kind, info.code.as_deref()),
            (ErrorKind::Permission, Some("AccessDeniedException"))
        );

        let boxed: Box<dyn std::error::Error + Send + Sync> = Box::new(aws::coded(error));
        assert_eq!(describe_error(boxed.as_ref()).kind, ErrorKind::Permission);
    }
}
