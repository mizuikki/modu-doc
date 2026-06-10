use crate::db;

pub struct ProjectService;

impl ProjectService {
    pub fn now() -> String {
        db::now_iso()
    }
}
