use crate::db;

pub struct WorkspaceService;

impl WorkspaceService {
    pub fn now() -> String {
        db::now_iso()
    }
}
