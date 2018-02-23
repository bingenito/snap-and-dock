/* globals fin */
'use strict';

/**
 * Created by haseebriaz on 03/03/15.
 */

function getUndockButton() {
    return document.getElementById('undockButton');
}

function enableUndock(value) {

    var currentClasses = getUndockButton().classList;
    if (value) {
        currentClasses.remove('hidden');
    } else {
        currentClasses.add('hidden');
    }
}

function onDock(message) {

    if (message.windowName === window.name) {
        enableUndock(true);
    }
}

function updateDimensions(bounds) {

    document.getElementById('dimensions').innerHTML = 'x: ' + bounds.left + ', y: ' + bounds.top + ', width: ' + bounds.width + ', height: ' + bounds.height;
}

function onUnDock(message) {
    if (message.windowName === window.name) {
        enableUndock(false);
    }
}

function undock() {

    var currentWindow = fin.desktop.Window.getCurrent();
    currentWindow.leaveGroup();
}

fin.desktop.main(function() {

    document.getElementById('title').innerText = window.name;

    getUndockButton().addEventListener('click', undock);

    fin.desktop.InterApplicationBus.subscribe('*', 'window-docked', onDock);
    fin.desktop.InterApplicationBus.subscribe('*', 'window-undocked', onUnDock);

    var currentWindow = fin.desktop.Window.getCurrent();
    currentWindow.getBounds(updateDimensions);
    currentWindow.addEventListener('bounds-changing', updateDimensions);
});
