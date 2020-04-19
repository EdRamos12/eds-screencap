// Applies theme on the window

// Import
const { ipcRenderer } = require('electron');

// When elements on the html is loaded, fires this function
window.addEventListener('DOMContentLoaded', () => {
    // Gets user data
    let themeInfo = ipcRenderer.sendSync('data-request').theme;

    // If theme is dark, then change CSS vars values
    if (themeInfo == 'dark') {
        let root = document.documentElement;
        root.style.setProperty('--bgTheme', '#121212');
        root.style.setProperty('--fontColor', 'white');
    }
});
// And that's it, simple enough i guess :T