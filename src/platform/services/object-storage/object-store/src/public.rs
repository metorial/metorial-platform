use hmac::{Hmac, Mac};
use object_store_backends::{PublicUrlPurpose, SignedUrl};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

pub const MIN_SIGNING_SECRET_LENGTH: usize = 32;
pub const MAX_EXPIRATION_SECS: u64 = 7 * 24 * 60 * 60;

#[derive(Debug, PartialEq, Eq)]
pub enum PublicUrlError {
    Expired,
    InvalidSignature,
}

/// Signs public object URLs that point at this service's own public listener instead of the
/// backend, so the backend never has to be reachable by the clients that receive the URLs.
pub struct PublicUrlSigner {
    base_url: String,
    secret: Vec<u8>,
}

impl PublicUrlSigner {
    pub(crate) fn multipart_key(&self) -> [u8; 32] {
        let mut mac = HmacSha256::new_from_slice(&self.secret).expect("HMAC accepts any key size");
        mac.update(b"metorial/object-storage/public-multipart/aes-256-gcm/v1");
        mac.finalize().into_bytes().into()
    }

    pub(crate) fn part_url(&self) -> String {
        format!("{}/upload-part", self.base_url)
    }

    fn object_url(&self, bucket: &str, key: &str) -> String {
        format!(
            "{}/{}/{}",
            self.base_url,
            percent_encode(bucket),
            key.split('/')
                .map(percent_encode)
                .collect::<Vec<_>>()
                .join("/")
        )
    }

    pub fn new(base_url: &str, secret: &str) -> anyhow::Result<Self> {
        let base_url = base_url.trim().trim_end_matches('/');
        if !(base_url.starts_with("http://") || base_url.starts_with("https://")) {
            anyhow::bail!("public.base_url must be an http(s) URL");
        }

        if secret.len() < MIN_SIGNING_SECRET_LENGTH {
            anyhow::bail!(
                "public.signing_secret must be at least {} characters",
                MIN_SIGNING_SECRET_LENGTH
            );
        }

        Ok(Self {
            base_url: base_url.to_string(),
            secret: secret.as_bytes().to_vec(),
        })
    }

    pub fn sign(
        &self,
        bucket: &str,
        key: &str,
        purpose: PublicUrlPurpose,
        expiration_secs: u64,
        size: Option<u64>,
        now: i64,
    ) -> SignedUrl {
        let expires = now + clamp_expiration(expiration_secs) as i64;
        let purpose = purpose_name(purpose);
        let signature = hex::encode(
            self.mac(bucket, key, purpose, expires, size)
                .finalize()
                .into_bytes(),
        );
        let size_param = size
            .map(|size| format!("&size={}", size))
            .unwrap_or_default();

        SignedUrl::new(format!(
            "{}?expires={}&purpose={}{}&signature={}",
            self.object_url(bucket, key),
            expires,
            purpose,
            size_param,
            signature
        ))
    }

    #[allow(clippy::too_many_arguments)]
    pub fn verify(
        &self,
        bucket: &str,
        key: &str,
        purpose: PublicUrlPurpose,
        expires: i64,
        size: Option<u64>,
        signature: &str,
        now: i64,
    ) -> Result<(), PublicUrlError> {
        let signature = hex::decode(signature).map_err(|_| PublicUrlError::InvalidSignature)?;

        self.mac(bucket, key, purpose_name(purpose), expires, size)
            .verify_slice(&signature)
            .map_err(|_| PublicUrlError::InvalidSignature)?;

        if expires < now {
            return Err(PublicUrlError::Expired);
        }

        Ok(())
    }

    // Sized URLs use their own version so that dropping `size` from one can never turn it into a
    // valid unsized URL.
    fn mac(
        &self,
        bucket: &str,
        key: &str,
        purpose: &str,
        expires: i64,
        size: Option<u64>,
    ) -> HmacSha256 {
        let mut mac = HmacSha256::new_from_slice(&self.secret).expect("HMAC accepts any key size");
        let message = match size {
            Some(size) => format!(
                "v2\n{}\n{}\n{}\n{}\n{}",
                purpose, bucket, key, expires, size
            ),
            None => format!("v1\n{}\n{}\n{}\n{}", purpose, bucket, key, expires),
        };
        mac.update(message.as_bytes());
        mac
    }
}

pub fn clamp_expiration(expiration_secs: u64) -> u64 {
    expiration_secs.clamp(1, MAX_EXPIRATION_SECS)
}

pub fn purpose_name(purpose: PublicUrlPurpose) -> &'static str {
    match purpose {
        PublicUrlPurpose::Retrieve => "retrieve",
        PublicUrlPurpose::Upload => "upload",
    }
}

fn percent_encode(segment: &str) -> String {
    let mut encoded = String::with_capacity(segment.len());

    for byte in segment.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(byte as char)
            }
            _ => encoded.push_str(&format!("%{:02X}", byte)),
        }
    }

    encoded
}

#[cfg(test)]
mod tests {
    use super::*;

    fn signer() -> PublicUrlSigner {
        PublicUrlSigner::new(
            "https://metorial.example.com/object-storage/",
            "0123456789abcdef0123456789abcdef",
        )
        .unwrap()
    }

    fn query(url: &str, name: &str) -> String {
        url.split_once('?')
            .unwrap()
            .1
            .split('&')
            .find_map(|pair| pair.strip_prefix(&format!("{}=", name)))
            .unwrap()
            .to_string()
    }

    #[test]
    fn signs_urls_below_the_base_url() {
        let url = signer().sign(
            "files",
            "a b/c.txt",
            PublicUrlPurpose::Retrieve,
            60,
            None,
            1000,
        );

        assert!(url.url.starts_with(
            "https://metorial.example.com/object-storage/files/a%20b/c.txt?expires=1060&purpose=retrieve&signature="
        ));
        assert!(url.headers.is_empty());
    }

    #[test]
    fn verifies_its_own_signatures() {
        let signer = signer();
        let url = signer.sign("files", "a/b.txt", PublicUrlPurpose::Upload, 60, None, 1000);
        let signature = query(&url.url, "signature");

        assert_eq!(
            signer.verify(
                "files",
                "a/b.txt",
                PublicUrlPurpose::Upload,
                1060,
                None,
                &signature,
                1059
            ),
            Ok(())
        );
    }

    #[test]
    fn rejects_tampered_requests() {
        let signer = signer();
        let url = signer.sign(
            "files",
            "a/b.txt",
            PublicUrlPurpose::Retrieve,
            60,
            None,
            1000,
        );
        let signature = query(&url.url, "signature");

        for (bucket, key, purpose, expires) in [
            ("other", "a/b.txt", PublicUrlPurpose::Retrieve, 1060),
            ("files", "a/c.txt", PublicUrlPurpose::Retrieve, 1060),
            ("files", "a/b.txt", PublicUrlPurpose::Upload, 1060),
            ("files", "a/b.txt", PublicUrlPurpose::Retrieve, 9999),
        ] {
            assert_eq!(
                signer.verify(bucket, key, purpose, expires, None, &signature, 1000),
                Err(PublicUrlError::InvalidSignature)
            );
        }

        assert_eq!(
            signer.verify(
                "files",
                "a/b.txt",
                PublicUrlPurpose::Retrieve,
                1060,
                None,
                "zz",
                1000
            ),
            Err(PublicUrlError::InvalidSignature)
        );
    }

    #[test]
    fn rejects_expired_urls() {
        let signer = signer();
        let url = signer.sign("files", "a.txt", PublicUrlPurpose::Retrieve, 60, None, 1000);
        let signature = query(&url.url, "signature");

        assert_eq!(
            signer.verify(
                "files",
                "a.txt",
                PublicUrlPurpose::Retrieve,
                1060,
                None,
                &signature,
                1061
            ),
            Err(PublicUrlError::Expired)
        );
    }

    #[test]
    fn binds_a_signed_size() {
        let signer = signer();
        let url = signer.sign(
            "files",
            "a.txt",
            PublicUrlPurpose::Upload,
            60,
            Some(12),
            1000,
        );
        let signature = query(&url.url, "signature");

        assert_eq!(query(&url.url, "size"), "12");
        assert_eq!(
            signer.verify(
                "files",
                "a.txt",
                PublicUrlPurpose::Upload,
                1060,
                Some(12),
                &signature,
                1000
            ),
            Ok(())
        );

        for size in [None, Some(13)] {
            assert_eq!(
                signer.verify(
                    "files",
                    "a.txt",
                    PublicUrlPurpose::Upload,
                    1060,
                    size,
                    &signature,
                    1000
                ),
                Err(PublicUrlError::InvalidSignature)
            );
        }
    }

    #[test]
    fn caps_the_expiration() {
        let url = signer().sign(
            "files",
            "a.txt",
            PublicUrlPurpose::Retrieve,
            u64::MAX,
            None,
            0,
        );

        assert_eq!(query(&url.url, "expires"), MAX_EXPIRATION_SECS.to_string());
    }

    #[test]
    fn clamps_expirations_to_the_signable_range() {
        assert_eq!(clamp_expiration(0), 1);
        assert_eq!(clamp_expiration(3600), 3600);
        assert_eq!(clamp_expiration(u64::MAX), MAX_EXPIRATION_SECS);
    }

    #[test]
    fn refuses_weak_configuration() {
        assert!(PublicUrlSigner::new("https://x", "short").is_err());
        assert!(PublicUrlSigner::new("ftp://x", "0123456789abcdef0123456789abcdef").is_err());
    }
}
