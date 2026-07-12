pub mod guard;
pub mod service;

pub use guard::{extract_user, require_admin_or_self, require_role};
pub use service::{
    authenticate, change_password, create_user, ensure_default_users, generate_temp_password, generate_token,
    get_user_by_id, hash_password, hash_token, invalidate_session, is_strong_password, list_users,
    reset_password, update_user, validate_session, verify_password,
};
