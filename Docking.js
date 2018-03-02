/* globals fin */
import { DockingManager, GroupEventReason, GroupEventMemberOf } from './DockingManager.js';

/**
 * Created by haseebriaz on 03/03/15.
 */

window.addEventListener('DOMContentLoaded', () => fin.desktop.main(onOpenFinReady));

function onOpenFinReady() {

    const dockingManager = new DockingManager();
    // Still works: var dockingManager = DockingManager.getInstance();

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

    let counter = 0;
    document.getElementById('createWindows').onclick = () => { createAndRegister(++counter) };

    // convenience to restore up to 10 docked child windows from previous persistance
    for (let tempCounter = 0; tempCounter < 10; tempCounter++) {
        const DOCKING_MANAGER_NAMESPACE_PREFIX = 'dockingManager.';
        const windowStorageKey = `${DOCKING_MANAGER_NAMESPACE_PREFIX}${fin.desktop.Application.getCurrent().uuid}.child${tempCounter}`;
        if (localStorage.getItem(windowStorageKey)) {
            createAndRegister(tempCounter);
            counter = tempCounter;
        }
    }
    
    fin.desktop.InterApplicationBus.subscribe('*', 'window-docked', function(message) {
        console.log('window-docked subscription: ' + message.windowName + ' joined group');
    });

    fin.desktop.InterApplicationBus.subscribe('*', 'window-undocked', function(message) {
        console.log('window-undocked subscription: ' + message.windowName + ' left group');
    });

    // bus-based handling for external java application docking

    fin.desktop.InterApplicationBus.subscribe('*', 'register-docking-window', function(message) {
        const { appUuid, name } = message;
        console.log('Registering external window', appUuid, name);
        const javaWindow = fin.desktop.Window.wrap(appUuid, name);
        dockingManager.register(javaWindow);
    });

    fin.desktop.InterApplicationBus.publish("status-update", {status: 'ready'});
}

function createAndRegister(windowNameSuffix) {

    const windowOptions = {
        name: `child${windowNameSuffix}`,
        url: 'childWindow.html',
        defaultWidth: 200,
        defaultHeight: 150,
        defaultTop: (screen.availHeight - 200) / 2,
        defaultLeft: (screen.availWidth - 150) / 2,
        frame: false,
        autoShow: true
    };

    const openfinWindow = new fin.desktop.Window(
        windowOptions,
        function() {
            DockingManager.getInstance().register(openfinWindow);
        }
    );
    
    // To test using DockingWindow to create the OpenFin window
    //
    // dockingManager.register(windowOptions);

    openfinWindow.addEventListener('group-changed', onGroupChanged);
}

function onGroupChanged(groupEvent) {

    // leaving is simple ... if member of 'nothing', then this window is leaving
    if (groupEvent.memberOf === GroupEventMemberOf.NOTHING) {
        console.log('group-changed event: ' + groupEvent.name + ' left group');
        return;
    }

    // joining is a little more complicated ...
    // if sourceWindowName is the same as name, that is a primary join event
    // but at group setup, the first window is only a 'target' of a join
    // (for the 2 setup events, the target group has just those 2 members)
    if (groupEvent.reason === GroupEventReason.JOIN) {
        if (groupEvent.sourceWindowName === groupEvent.name ||
            groupEvent.targetGroup.length === 2 &&
            groupEvent.targetWindowName  === groupEvent.name) {
            console.log('group-changed event: ' + groupEvent.name + ' joined group');
        }
    }
}
