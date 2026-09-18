use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

fn show_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_main_window(app);
        }))
        .setup(|app| {
            let show_item = MenuItem::with_id(app, "show", "Open Atmosphere", true, None::<&str>)?;
            let playback_item =
                MenuItem::with_id(app, "playback", "Play / Pause", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit Atmosphere", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_item, &playback_item, &quit_item])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().expect("Atmosphere icon").clone())
                .tooltip("Atmosphere")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => show_main_window(app),
                    "playback" => {
                        let _ = app.emit("atmosphere://toggle-playback", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Atmosphere");
}
