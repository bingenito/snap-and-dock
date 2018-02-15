/* globals fin */
'use strict';

/**
 * Created by haseebriaz on 03/03/15.
 */

var undockButton = null;

function enableUndock(value) {

    document.getElementById('undockButton').style.display = value ? 'block' : 'none';
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

    fin.desktop.InterApplicationBus.publish('undock-window', {

        windowName: window.name
    });

}

fin.desktop.main(function() {

    document.getElementById('title').innerText = window.name;

    undockButton = document.getElementById('undockButton');
    undockButton.addEventListener('click', undock);
    enableUndock(false);

    fin.desktop.InterApplicationBus.subscribe('*', 'window-docked', onDock);
    fin.desktop.InterApplicationBus.subscribe('*', 'window-undocked', onUnDock);

    var currentWindow = fin.desktop.Window.getCurrent();
    currentWindow.getBounds(updateDimensions);
    currentWindow.addEventListener('bounds-changing', updateDimensions);
});
