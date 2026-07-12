use std::sync::Arc;
use tauri::State;
use uuid::Uuid;

use crate::auth::extract_user;
use crate::BackendState;
use crate::Error;

#[tauri::command(rename_all = "snake_case")]
pub async fn save_photo(
    backend: State<'_, Arc<BackendState>>,
    token: String,
    bytes: Vec<u8>,
    filename: String,
) -> Result<PhotoSaved, Error> {
    let _user = extract_user(&backend, &token).await?;
    let db = backend.db().await?;

    let base_dir = db.base_dir();
    let preferred_name = if filename.is_empty() {
        Uuid::new_v4().to_string()
    } else {
        filename
    };

    let path = crate::fs::save_photo(&base_dir, &preferred_name, &bytes)?;

    Ok(PhotoSaved {
        path: path.to_string_lossy().to_string(),
    })
}

#[derive(Debug, serde::Serialize)]
pub struct PhotoSaved {
    pub path: String,
}

/// Description of an available camera returned by [`list_cameras`].
#[derive(Debug, serde::Serialize)]
pub struct CameraDescriptor {
    pub index: usize,
    pub name: String,
}

/// Result of a native camera capture from [`capture_photo`].
#[derive(Debug, serde::Serialize)]
pub struct CaptureResult {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
}

/// List cameras available to the native backend.
#[tauri::command(rename_all = "snake_case")]
pub async fn list_cameras() -> Result<Vec<CameraDescriptor>, Error> {
    tokio::task::spawn_blocking(|| {
        let cameras = nokhwa::query(nokhwa::utils::ApiBackend::Auto)
            .map_err(|e| Error::Internal(format!("Failed to list cameras: {e}")))?;

        Ok(cameras
            .into_iter()
            .enumerate()
            .map(|(index, info)| CameraDescriptor {
                index,
                name: info.human_name(),
            })
            .collect())
    })
    .await
    .map_err(|e| Error::Internal(format!("Camera list task failed: {e}")))?
}

/// Capture a single frame from the native camera at `index` (defaulting to the
/// first available camera) and return it as a base64 JPEG data URL.
#[tauri::command(rename_all = "snake_case")]
pub async fn capture_photo(index: Option<usize>) -> Result<CaptureResult, Error> {
    tokio::task::spawn_blocking(move || {
        use image::codecs::jpeg::JpegEncoder;
        use image::ImageEncoder;
        use nokhwa::pixel_format::RgbFormat;
        use nokhwa::utils::{ApiBackend, CameraIndex, RequestedFormat, RequestedFormatType};
        use nokhwa::Camera;

        // Enumerate cameras first so we can produce a clear "no camera" message.
        let cameras = nokhwa::query(ApiBackend::Auto)
            .map_err(|e| Error::Internal(format!("Failed to query cameras: {e}")))?;

        if cameras.is_empty() {
            return Err(Error::Internal("No camera found on this device".to_string()));
        }

        let selected_index = index.unwrap_or(0);
        let selected_info = cameras.get(selected_index).ok_or_else(|| {
            Error::Internal(format!(
                "Camera index {selected_index} is not available ({} camera(s) found)",
                cameras.len()
            ))
        })?;

        let camera_index = selected_info.index().clone();
        let camera_idx_num = match camera_index {
            CameraIndex::Index(i) => i as usize,
            CameraIndex::String(_) => selected_index,
        };

        let format = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestResolution);
        let mut camera = Camera::new(camera_index, format).map_err(|e| {
            Error::Internal(format!(
                "Failed to open camera {} ({}): {e}",
                camera_idx_num,
                selected_info.human_name()
            ))
        })?;

        camera.open_stream().map_err(|e| {
            Error::Internal(format!(
                "Failed to start camera {} stream: {e}",
                camera_idx_num
            ))
        })?;

        let buffer = camera.frame().map_err(|e| {
            Error::Internal(format!(
                "Failed to capture frame from camera {}: {e}",
                camera_idx_num
            ))
        })?;

        let resolution = buffer.resolution();
        let width = resolution.width();
        let height = resolution.height();

        let rgb_image = buffer.decode_image::<RgbFormat>().map_err(|e| {
            Error::Internal(format!("Failed to decode camera frame: {e}"))
        })?;

        let mut jpeg_bytes = Vec::new();
        JpegEncoder::new_with_quality(&mut jpeg_bytes, 90)
            .write_image(
                rgb_image.as_raw(),
                width,
                height,
                image::ExtendedColorType::Rgb8,
            )
            .map_err(|e| Error::Internal(format!("Failed to encode JPEG: {e}")))?;

        let data_url = format!(
            "data:image/jpeg;base64,{}",
            base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &jpeg_bytes)
        );

        Ok(CaptureResult {
            data_url,
            width,
            height,
        })
    })
    .await
    .map_err(|e| Error::Internal(format!("Camera capture task failed: {e}")))?
}

#[tauri::command(rename_all = "snake_case")]
pub async fn get_photos_dir(
    backend: State<'_, Arc<BackendState>>,
    token: String,
) -> Result<String, Error> {
    let _user = extract_user(&backend, &token).await?;
    let db = backend.db().await?;
    let dir = crate::db::photos_dir(db.base_dir());
    Ok(dir.to_string_lossy().to_string())
}
