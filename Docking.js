/* globals fin, DockingManager */
'use strict';

/**
 * Created by haseebriaz on 03/03/15.
 */

window.addEventListener('DOMContentLoaded', function() {
    fin.desktop.main(function() {

        var dockingManager = DockingManager.getInstance();

        // Apply init() to the DockingManager singleton as below
        // if you want to modify the docking parameters
        //
        // dockingManager.init({
        //     spacing: 0,
        //     range: 10,
        //     undockOffsetX: 15,
        //     undockOffsetY: 15
        // });

        dockingManager.register(fin.desktop.Window.getCurrent(), false);
        var counter = 0;

        function createChildWindow() {

            var windowOptions = {
                name: 'child' + counter++,
                url: 'childWindow.html',
                defaultWidth: 200,
                defaultHeight: 150,
                defaultTop: (screen.availHeight - 200) / 2,
                defaultLeft: (screen.availWidth - 150) / 2,
                frame: false,
                resize: true,
                windowState: 'normal',
                autoShow: true
            };

            var dw = new fin.desktop.Window(
                windowOptions,
                function() {
                    dockingManager.register(dw);
                }
            );

            // To test using DockingWindow to create the OpenFin window
            //
            // dockingManager.register(windowOptions);
        }

        document.getElementById('createWindows').onclick = createChildWindow;

        fin.desktop.InterApplicationBus.subscribe('*', 'register-docking-window', function(message) {
            var appUuid = message.applicationUuid;
            var name = message.windowName;
            console.log('Registering docking window', appUuid, name);
            var javaWindow = fin.desktop.Window.wrap(appUuid, name);
            dockingManager.register(javaWindow);
        });

        fin.desktop.InterApplicationBus.subscribe('*', 'window-docked', function(message) {
            console.log('Window ' + message.windowName + ' joined group');
        });

        fin.desktop.InterApplicationBus.subscribe('*', 'window-undocked', function(message) {
            console.log('Window ' + message.windowName + ' left group');
        });

        fin.desktop.InterApplicationBus.publish("status-update", {status: 'ready'});

    });

});
