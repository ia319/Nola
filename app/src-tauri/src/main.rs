// Keep release builds from opening a separate Windows console.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    nola_desktop_lib::run();
}
