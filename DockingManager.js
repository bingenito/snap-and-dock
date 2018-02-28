/* globals fin */
'use strict';

/**
 * Created by haseebriaz on 03/03/15.
 */

var GroupEventReason = {
    DISBAND: 'disband',
    JOIN: 'join',
    LEAVE: 'leave',
    MERGE: 'merge'
};

var GroupEventMemberOf = {
    NOTHING: 'nothing',
    SOURCE: 'source',
    TARGET: 'target'
};

var monitors = [];
function getMonitorInfo(){

    fin.desktop.System.getMonitorInfo(onMonitorInfo);
}

function onMonitorInfo(info){

    var monitor = info.primaryMonitor.availableRect;
    monitors.push({x: monitor.left, y: monitor.top, width: monitor.right - monitor.left, height: monitor.bottom - monitor.top});

    var currentMonitors = info.nonPrimaryMonitors;
    for(var i = 0; i < currentMonitors.length; i++){

        monitor = currentMonitors[i].availableRect;
        monitors.push({x: monitor.left, y: monitor.top, width: monitor.right - monitor.left, height: monitor.bottom - monitor.top});
    }
}

function applyOptions(instance, options) {

    if (!options) return;

    // 'range' is the distance between windows at which snapping applies
    if (!isNaN(Number.parseInt(options.range)) && options.range >= 0) {

        instance.range = options.range;
    }

    // 'spacing' is the distance between windows when they become docked
    if (!isNaN(Number.parseInt(options.spacing)) && options.spacing >= 0) {

        instance.spacing = options.spacing;
    }

    // 'undockOffsetX/Y' are offset values - they make the undocked window 'jump' a number of pixels
    if (!isNaN(Number.parseInt(options.undockOffsetX)) && options.undockOffsetX >= 0) {
        instance.undockOffsetX = options.undockOffsetX;
    }
    if (!isNaN(Number.parseInt(options.undockOffsetY)) && options.undockOffsetY >= 0) {
        instance.undockOffsetY = options.undockOffsetY;
    }
}

var DockingGroup = (function() {

    function DockingGroup() {

        this.children = [];
    }

    DockingGroup.prototype.children = [];
    DockingGroup.prototype.parent = null;
    DockingGroup.prototype.onAdd = function() {};
    DockingGroup.prototype.onRemove = function() {};

    DockingGroup.prototype.add = function(window) {

        if (window.group === this) {
            return;
        }

         this.children.push(window);
        window.group = this;
       // window.onAdd();
    };

    DockingGroup.prototype.remove = function(window) {

        var index = this.children.indexOf(window);
        if (index >= 0) {

            this.children.splice(index, 1);
            window.group = null;
          //  window.onRemove();
        }
    };

    DockingGroup.prototype.has = function(window) {

        return this.children.indexOf(window) >= 0;
    };

    return DockingGroup;
})();

var DockableWindow = (function() {

    var openDockableWindows = {};

    var DOCKING_MANAGER_NAMESPACE_PREFIX = 'dockingManager.';
    function getFullStorageKey(id) {
        return DOCKING_MANAGER_NAMESPACE_PREFIX +
            fin.desktop.Application.getCurrent().uuid +
            '.' + id;
    }

    function retrieveRelationshipsFor(id) {
        var storedRelationships = JSON.parse(localStorage.getItem(getFullStorageKey(id)));
        return storedRelationships || [];
    }

    function createRelationship(id1, id2) {
        var partners = retrieveRelationshipsFor(id1);
        if (partners.indexOf(id2) !== -1) {
            return;
        }
        partners.push(id2);
        localStorage.setItem(getFullStorageKey(id1), JSON.stringify(partners));
    }

    function createRelationshipsBetween(id1, id2) {
        createRelationship(id1, id2);
        createRelationship(id2, id1);
    }

    function removeRelationship(id1, id2) {
        var currentPartners = retrieveRelationshipsFor(id1);
        var partnerIndex = currentPartners.indexOf(id2);
        if (partnerIndex === -1) {
            return;
        }

        currentPartners.splice(partnerIndex, 1);

        if (currentPartners.length > 0) {
            localStorage.setItem(getFullStorageKey(id1), JSON.stringify(currentPartners));
        } else {
            localStorage.removeItem(getFullStorageKey(id1));
        }
    }

    function removeAllRelationships(id) {
        // grab existing partner windows before removing all trace of this window's persistence
        var currentPartners = retrieveRelationshipsFor(id);
        localStorage.removeItem(getFullStorageKey(id));

        // remove all 'reverse' relationships from partners too
        for (var i = 0; i < currentPartners.length; i++) {
            removeRelationship(currentPartners[i], id);
        }
    }

    function DockableWindow(windowOrOptions, dockingOptions) {

        this.createDelegates();

        this.name = windowOrOptions.name;

        if (windowOrOptions instanceof fin.desktop.Window) {

            this.openfinWindow = windowOrOptions;
        } else {

            this.openfinWindow = new fin.desktop.Window(windowOrOptions);
        }

        // OpenFin Window is definitely created now, but may not be fully initialized
        var dockableWindow = this;
        dockableWindow.openfinWindow.getInfo(
            function() {
                dockableWindow.onWindowInitialized();
            },
            function() {
                dockableWindow.openfinWindow.addEventListener('initialized', function() {
                    dockableWindow.onWindowInitialized();
                });
            }
        );

        applyOptions(this, dockingOptions);

        this.currentRange = this.range;
        openDockableWindows[this.name] = this;
    }

    DockableWindow.prototype.name = '';
    DockableWindow.prototype.range = 40;
    DockableWindow.prototype.currentRange = 40;
    DockableWindow.prototype.x = 0;
    DockableWindow.prototype.y = 0;
    DockableWindow.prototype.width = 0;
    DockableWindow.prototype.height = 0;
    DockableWindow.prototype.undockOffsetX = 0;
    DockableWindow.prototype.undockOffsetY = 0;
    DockableWindow.prototype.openfinWindow = null;
    DockableWindow.prototype.dockableToOthers = true;
    DockableWindow.prototype.acceptDockingConnection = true;
    DockableWindow.prototype.minimized = false;
    DockableWindow.prototype.group = null;
    DockableWindow.prototype._moveEvent = {bounds:{}};

    DockableWindow.prototype.onMove = function() {};
    DockableWindow.prototype.onClose = function() {};
    DockableWindow.prototype.onFocus = function() {};
    DockableWindow.prototype.onMoveComplete = function() {};
    DockableWindow.prototype.onMinimize = function() {};
    DockableWindow.prototype.onRestore = function() {};
    DockableWindow.prototype.onLeaveGroup = function() {};

    DockableWindow.prototype.createDelegates = function() {

        this.completeInitialization = this.completeInitialization.bind(this);
        this.onMove = this.onMove.bind(this);
        this.onMoved = this.onMoved.bind(this);
        this.onBounds = this.onBounds.bind(this);
        this.onBoundsChanging = this.onBoundsChanging.bind(this);
        this.onClosed = this.onClosed.bind(this);
        this.onFocused = this.onFocused.bind(this);
        this.onGroupChanged = this.onGroupChanged.bind(this);
        this.onMoveComplete = this.onMoved.bind(this);
        this.onBoundsChanged = this.onBoundsChanged.bind(this);
        this.onBoundsUpdate = this.onBoundsUpdate.bind(this);
        this.onMinimized = this.onMinimized.bind(this);
        this.onRestored = this.onRestored.bind(this);
    };

    DockableWindow.prototype.onWindowInitialized = function() {

        // OpenFin window close triggers a 'hidden' event, so do not tie minimize action to this event
        this.openfinWindow.getBounds(this.completeInitialization);
        this.openfinWindow.disableFrame();
        this.openfinWindow.addEventListener('disabled-frame-bounds-changing', this.onBoundsChanging);
        this.openfinWindow.addEventListener('disabled-frame-bounds-changed', this.onBoundsChanged);
        this.openfinWindow.addEventListener('bounds-changed', this.onBoundsUpdate);
        this.openfinWindow.addEventListener('closed', this.onClosed);
        this.openfinWindow.addEventListener('minimized', this.onMinimized);
        this.openfinWindow.addEventListener('restored', this.onRestored);
        this.openfinWindow.addEventListener('shown', this.onRestored);
        this.openfinWindow.addEventListener('focused', this.onFocused);
        this.openfinWindow.addEventListener('group-changed', this.onGroupChanged);
    };

    DockableWindow.prototype.completeInitialization = function(initialWindowBounds) {

        this.onBounds(initialWindowBounds);

        var formerDockingPartners = retrieveRelationshipsFor(this.name);
        for (var i = 0; i < formerDockingPartners.length; i++) {
            var potentialPartnerName = formerDockingPartners[i];

            var potentialPartnerWindow = openDockableWindows[potentialPartnerName];
            if (!potentialPartnerWindow ||
                !DockingManager.getInstance().isSnapable(this, potentialPartnerWindow) &&
                !DockingManager.getInstance().isSnapable(potentialPartnerWindow, this)) {
                // garbage collection, essentially
                // note, if a former partner has not been opened yet, then re-connecting
                // that pair of windows will be handled by that window's persisted relationships
                removeRelationship(this.name, potentialPartnerName);
                continue;
            }

            this.joinGroup(potentialPartnerWindow);
        }
    };

    DockableWindow.prototype.onBounds = function(bounds) {

        this.width = bounds.width;
        this.height = bounds.height;
        this.x = bounds.left;
        this.y = bounds.top;
    };

    DockableWindow.prototype.onBoundsUpdate = function(bounds) {

        this.x = bounds.left;
        this.y = bounds.top;
        this.width = bounds.width;
        this.height = bounds.height;
    };

    DockableWindow.prototype.onBoundsChanging = function(bounds) {

        var event = this._moveEvent;
        event.target = this;
        event.preventDefault = false;
        event.bounds.x = bounds.left;
        event.bounds.y = bounds.top;
        event.bounds.width = this.width;
        event.bounds.height = this.height;
        event.bounds.changedWidth = bounds.width;
        event.bounds.changedHeight = bounds.height;

        this.onMove(event);

        if (event.preventDefault) {
            return;
        }

        if (!this.group) {
            this.setOpacity(0.5);
        }

        this.moveTo(bounds.left, bounds.top, bounds.width, bounds.height);
    };

    DockableWindow.prototype.onBoundsChanged = function() {

        this.setOpacity(1);
        this.onMoveComplete({
            target: this
        });
    };

    DockableWindow.prototype.onClosed = function() {

        this.onClose({
            target: this
        });
    };

    DockableWindow.prototype.onFocused = function() {

        this.onFocus(this);
    };

    DockableWindow.prototype.onMinimized = function() {

        this.minimized = true;
        this.onMinimize(this);
    };

    DockableWindow.prototype.onRestored = function() {

        this.minimized = false;
        this.onRestore(this);
    };

    DockableWindow.prototype.moveTo = function(x, y, width, height) {

        this.x = x;
        this.y = y;
        this.width = width ? width : this.width;
        this.height = height ? height : this.height;

        this.openfinWindow.removeEventListener('disabled-frame-bounds-changing', this.onBoundsChanging);
        this.openfinWindow.setBounds(x, y, this.width, this.height, this.onMoved);
    };

    DockableWindow.prototype.onMoved = function() {

        this.openfinWindow.addEventListener('disabled-frame-bounds-changing', this.onBoundsChanging);
    };

    function intersect(window1, window2){

        // check right edge position of first window is to the left of left edge of second window, and so on ..
        // comparison is <= as (xpos + width) is one pixel to the right of the window
        return  !(window1.x + window1.width <= window2.x || window2.x + window2.width <= window1.x
        || window1.y + window1.height <= window2.y || window2.y + window2.height <= window1.y)
    }

    DockableWindow.prototype.onGroupChanged = function(groupEvent) {
        if (groupEvent.reason === GroupEventReason.LEAVE && groupEvent.sourceWindowName === this.name) {
            this.onLeaveGroup(this.name);
        }
    };

    DockableWindow.prototype.joinGroup = function(snappedPartnerWindow) {

        if (this.group || !this.dockableToOthers || !snappedPartnerWindow.acceptDockingConnection) {
            return;
        }

        if (snappedPartnerWindow.group) {

            for (var i = 0; i < snappedPartnerWindow.group.children.length; i++) {
                if (intersect(this, snappedPartnerWindow.group.children[i])) {
                    return;
                }
            }
        }

        if (this.group && !snappedPartnerWindow.group) {

            snappedPartnerWindow.joinGroup(this);
            return;
        }

        // openfin operations: frame and grouping
        // if both ungrouped, this will set up the initial group with both windows as members
        this.openfinWindow.enableFrame();
        snappedPartnerWindow.openfinWindow.enableFrame();
        this.openfinWindow.joinGroup(snappedPartnerWindow.openfinWindow);

        if (!this.group && !snappedPartnerWindow.group) {

            // both ungrouped .. set partner up with new group
            var dockingGroup = new DockingGroup();
            dockingGroup.add(snappedPartnerWindow);
            fin.desktop.InterApplicationBus.publish('window-docked', {windowName: snappedPartnerWindow.name});
        }

        snappedPartnerWindow.group.add(this);
        fin.desktop.InterApplicationBus.publish('window-docked', {windowName: this.name});

        createRelationshipsBetween(this.name, snappedPartnerWindow.name);
    };

    function getWindowByName(windowList, windowName) {
        for (var i = 0; i < windowList.length; i++) {
            if (windowList[i].name === windowName) {
                return windowList[i];
            }
        }
    }

    function regroup(allWindowsToRegroup, previousWindow, currentWindow, isNewGroup) {

        var currentWindowIndex = allWindowsToRegroup.indexOf(currentWindow);
        if (currentWindowIndex === -1) {
            return; // already traversed
        }

        // Important, get orig partnerships, before leave/join group destroys them below
        var partnerWindowNames = retrieveRelationshipsFor(currentWindow.name);

        // remove this window now from pending list, we should not be visiting it again
        allWindowsToRegroup.splice(currentWindowIndex, 1);
        if (isNewGroup) {
            currentWindow.leaveGroup();
            if (previousWindow) {
                currentWindow.joinGroup(previousWindow);
            }
        }

        for (var i = 0; i < partnerWindowNames.length; i++) {
            var partnerWindow = getWindowByName(allWindowsToRegroup, partnerWindowNames[i]);

            if (partnerWindow) {
                regroup(allWindowsToRegroup, currentWindow, partnerWindow, isNewGroup);
            }
        }
    }

    function checkForSplitGroup(dockingGroup) {

        if (dockingGroup.children.length < 2) {
            return;
        }

        var existingDockingGroup = dockingGroup;
        var windowsToRegroup = existingDockingGroup.children.concat();

        // loop, until no windows left to (re)group ....

        while (windowsToRegroup.length > 0) {
            var startWindow = windowsToRegroup[0];
            regroup(windowsToRegroup, null, startWindow, !existingDockingGroup);

            if (existingDockingGroup && startWindow.group) {
                existingDockingGroup = null;
            }
        }
    }

    DockableWindow.prototype.leaveGroup = function(isInitiator) {

        var group = this.group;
        if (!group) {
            return;
        }

        // detach window from OpenFin runtime group
        this.openfinWindow.disableFrame();
        this.openfinWindow.leaveGroup();

        group.remove(this);

        fin.desktop.InterApplicationBus.publish('window-undocked', {

            windowName: this.name
        });

        if (isInitiator) {
            // if this window initiated the undock procedure, move apart slightly from group
            this.openfinWindow.moveBy(this.undockOffsetX, this.undockOffsetY);
        }
        else if (!this.isInView()) {
            // if indirectly undocked e.g. last window in group
            this.moveTo(0, 0, this.width, this.height);
        }

        if (group.children.length === 1) {

            group.children[0].leaveGroup();
        }

        if (group.children.length > 0 && !this.isGroupInView(group)){

            group.children[0].moveTo(0, 0);
        }

        removeAllRelationships(this.name);

        if (isInitiator) {
            checkForSplitGroup(group);
        }
    };

    DockableWindow.prototype.isInView = function(){

        for (var i = 0; i < monitors.length; i++){

            if (intersect(this, monitors[i]) && this.y >= monitors[i].y) {

                return true;
            }
        }

        return false;
    };

    DockableWindow.prototype.setOpacity = function(value) {

        if (this.opacity === value) {
            return;
        }
        this.opacity = value;
        this.openfinWindow.animate({
            opacity: {
                opacity: value,
                duration: 0
            }
        });
    };

    DockableWindow.prototype.minimize = function() {

        if (this.minimized) {
            return;
        }
        this.openfinWindow.minimize();
    };

    DockableWindow.prototype.restore = function() {

        if (!this.minimized) {
            return;
        }
        this.openfinWindow.restore();
    };

    DockableWindow.prototype.isGroupInView = function(group){

        var inView = false;
        for(var i = 0; i < group.children.length; i++){

            if(group.children[i].isInView()){

                inView = true;
            }
        }

        return inView;
    };

    return DockableWindow;
})();

var DockingManager = (function() {

    var instance = null;
    var windows = [];
    var _snappedWindows = {};

    function DockingManager() {

        if (instance) {
            throw new Error('Only one instance of DockingManager is allowed. Use DockingManager.getInstance() to get the instance.');
        }

        instance = this;
        this.createDelegates();

        getMonitorInfo();
    }

    DockingManager.getInstance = function() {

        return instance ? instance : new DockingManager();
    };

    DockingManager.prototype.range = 40;
    DockingManager.prototype.spacing = 5;
    DockingManager.prototype.undockOffsetX = 0;
    DockingManager.prototype.undockOffsetY = 0;

    DockingManager.prototype.init = function(dockingOptions) {

        applyOptions(this, dockingOptions);
    };

    DockingManager.prototype.createDelegates = function() {

        this.onWindowMove = this.onWindowMove.bind(this);
        this.onWindowClose = this.onWindowClose.bind(this);
        this.bringWindowOrGroupToFront = this.bringWindowOrGroupToFront.bind(this);
        this.onWindowRestore = this.onWindowRestore.bind(this);
        this.onWindowMinimize = this.onWindowMinimize.bind(this);
        this.dockAllSnappedWindows = this.dockAllSnappedWindows.bind(this);
    };

    DockingManager.prototype.undockWindow = function(windowName) {

        for (var i = 0; i < windows.length; i++) {

            if (windows[i].name === windowName) {

                windows[i].leaveGroup(true);
            }
        }
    };

    DockingManager.prototype.undockAll = function() {

        for (var i = 0; i < windows.length; i++) {
            windows[i].leaveGroup();
        }
    };

    DockingManager.prototype.register = function(window, dockableToOthers) {

        for (var i = 0; i < windows.length; i++) {
            if (windows[i].name === window.name) {
                return;
            }
        }

        var dockableWindow = new DockableWindow(window, {
            range: this.range,
            undockOffsetX: this.undockOffsetX,
            undockOffsetY: this.undockOffsetY
        });
        dockableWindow.dockableToOthers = (dockableToOthers === undefined || dockableToOthers !== false);
        dockableWindow.onMove = this.onWindowMove;
        dockableWindow.onMoveComplete = this.dockAllSnappedWindows;
        dockableWindow.onClose = this.onWindowClose;
        dockableWindow.onFocus = this.bringWindowOrGroupToFront;
        dockableWindow.onRestore = this.onWindowRestore;
        dockableWindow.onMinimize = this.onWindowMinimize;
        dockableWindow.onLeaveGroup = this.undockWindow;
        windows.push(dockableWindow);
    };

    DockingManager.prototype.unregister = function(window) {
        this.unregisterByName(window.name)
    };

    DockingManager.prototype.unregisterByName = function(windowName) {

        for(var i = 0; i < windows.length; i++){

            if (windows[i].name === windowName) {
                var removedDockableWindow = windows.splice(i, 1)[0];
                // purge from DockableGroup etc., otherwise it will still influence other DockableWindows
                removedDockableWindow.leaveGroup();
            }
        }
    };

    DockingManager.prototype.onWindowClose = function(event) {

        this.unregister(event.target);
    };

    DockingManager.prototype.bringWindowOrGroupToFront = function(dockingWindow) {

        var dockingGroup = dockingWindow.group;
        if (!dockingGroup) {
            // just bring the single window to front
            dockingWindow.openfinWindow.bringToFront();
            return;
        }

        // otherwise bring the whole group, including the target window itself, to front
        for (var i = 0; i < dockingGroup.children.length; i++){

            dockingGroup.children[i].openfinWindow.bringToFront();
        }
    };

    DockingManager.prototype.onWindowRestore = function(dockableWindow) {

        var dockingGroup = dockableWindow.group;
        if (!dockingGroup) {
            return;
        }

        var windowsInGroup = dockingGroup.children;
        for (var i = 0; i < windowsInGroup.length; i++) {

            windowsInGroup[i].restore();
        }
    };

    DockingManager.prototype.onWindowMinimize = function(dockableWindow) {

        var dockingGroup = dockableWindow.group;
        if (!dockingGroup) {
            return;
        }

        var windowsInGroup = dockingGroup.children;
        for (var i = 0; i < windowsInGroup.length; i++) {

            windowsInGroup[i].minimize();
        }
    };

    DockingManager.prototype.onWindowMove = function(event) {

        var currentWindow = event.target;
        event.bounds.currentRange = currentWindow.currentRange;

        if(currentWindow.group) {
            return;
        }

        var position = {
            x: null,
            y: null
        };

        for (var i = windows.length - 1; i >= 0; i--) {

            var dockableWindow = windows[i];

            var snappingPosition = this.isSnapable(event.bounds, dockableWindow);

            if (!snappingPosition) {
                snappingPosition = this._reverse(this.isSnapable(dockableWindow, event.bounds));
            }

            if (snappingPosition) {

                currentWindow.currentRange = currentWindow.range + 10;
                var pos = this.snapToWindow(event, dockableWindow, snappingPosition);

                this.bringWindowOrGroupToFront(dockableWindow);

                if (!position.x) {
                    position.x = pos.x;
                }

                if (!position.y) {
                    position.y = pos.y;
                }

                this.addToSnapList(currentWindow, dockableWindow, snappingPosition);

            } else {

                currentWindow.currentRange = currentWindow.range;
                this.removeFromSnapList(currentWindow, dockableWindow);
            }
        }

        if (position.x || position.y) {

            event.preventDefault = true;

            position.x = position.x ? position.x : event.bounds.x;
            position.y = position.y ? position.y : event.bounds.y;

            currentWindow.moveTo(position.x, position.y);


            this.checkIfStillSnapped();
        }
    };

    DockingManager.prototype.checkIfStillSnapped = function() {

        for (var name in _snappedWindows) {

            var currentWindow = _snappedWindows[name];

            if (!currentWindow) {
                continue;
            }

            if(this.isSnapable(currentWindow[0], currentWindow[1])  || this.isSnapable(currentWindow[1], currentWindow[0])){

                continue;

            } else {
                //currentWindow[1].setOpacity(1);
                this.removeFromSnapList(currentWindow[0], currentWindow[1]);
            }
        }
    };

    DockingManager.prototype.isSnapable = function(currentWidow, window) {

        var isInVerticalZone = this._isPointInVerticalZone(window.y, window.y + window.height, currentWidow.y, currentWidow.height);

        if ((currentWidow.x > window.x + window.width - currentWidow.currentRange && currentWidow.x < window.x + window.width + currentWidow.currentRange) && isInVerticalZone) {

            return 'right';

        } else if ((currentWidow.x + currentWidow.width > window.x - currentWidow.currentRange && currentWidow.x + currentWidow.width < window.x + currentWidow.currentRange) && isInVerticalZone) {

            return 'left';

        } else {

            var isInHorizontalZone = this._isPointInHorizontalZone(window.x, window.x + window.width, currentWidow.x, currentWidow.width);

            if ((currentWidow.y > window.y + window.height - currentWidow.currentRange && currentWidow.y < window.y + window.height + currentWidow.currentRange) && isInHorizontalZone) {

                return 'bottom';

            } else if ((currentWidow.y + currentWidow.height > window.y - currentWidow.currentRange && currentWidow.y + currentWidow.height < window.y + currentWidow.currentRange) && isInHorizontalZone) {

                return 'top';
            } else {

                return false;
            }
        }
    };

    DockingManager.prototype._isPointInVerticalZone = function(startY, endY, y, height) {

        var bottom = y + height;
        return (y >= startY && y <= endY || bottom >= startY && bottom <= endY);
    };

    DockingManager.prototype._isPointInHorizontalZone = function(startX, endX, x, width) {

        var rightCorner = x + width;
        return (x >= startX && x <= endX || rightCorner >= startX && rightCorner <= endX);
    };

    DockingManager.prototype._reverse = function(value) {

        if (!value) {
            return null;
        }

        switch (value) {

            case 'right':
                return 'left';
            case 'left':
                return 'right';
            case 'top':
                return 'bottom';
            case 'bottom':
                return 'top';
            default:
                return null;
        }
    };

    DockingManager.prototype.snapToWindow = function(event, window, position) {

        var currentWindow = event.target;

        switch (position) {

            case 'right':
                return {
                    x: window.x + window.width + this.spacing,
                    y: this._getVerticalEdgeSnapping(window, event.bounds)
                };
            case 'left':
                return {
                    x: window.x - currentWindow.width - this.spacing,
                    y: this._getVerticalEdgeSnapping(window, event.bounds)
                };
            case 'top':
                return {
                    x: this._getHorizontalEdgeSnapping(window, event.bounds),
                    y: window.y - currentWindow.height - this.spacing
                };
            case 'bottom':
                return {
                    x: this._getHorizontalEdgeSnapping(window, event.bounds),
                    y: window.y + window.height + this.spacing
                };
        }
    };

    DockingManager.prototype._getVerticalEdgeSnapping = function(window, currentWindow) {

        if (currentWindow.y <= window.y + this.range && currentWindow.y >= window.y - this.range) {
            return window.y;
        }
        if (currentWindow.y + currentWindow.height >= window.y + window.height - this.range &&
            currentWindow.y + currentWindow.height <= window.y + window.height + this.range) {

            return window.y + window.height - currentWindow.height;
        }
        return null;
    };

    DockingManager.prototype._getHorizontalEdgeSnapping = function(window, currentWindow) {

        if (currentWindow.x <= window.x + this.range && currentWindow.x >= window.x - this.range) {
            return window.x;
        }
        if (currentWindow.x + currentWindow.width >= window.x + window.width - this.range &&
            currentWindow.x + currentWindow.width <= window.x + window.width + this.range) {

            return window.x + window.width - currentWindow.width;
        }
        return null;
    };

    DockingManager.prototype.addToSnapList = function(window1, window2, snappingPosition) {

        _snappedWindows[window1.name + window2.name] = [window1, window2, snappingPosition];

        window1.setOpacity(0.5);
        window2.setOpacity(0.5);

    };


    DockingManager.prototype.removeFromSnapList = function(window1, window2) {

        if (_snappedWindows[window1.name + window2.name]) {
            _snappedWindows[window1.name + window2.name] = null;
           // window1.setOpacity(1);
            window2.setOpacity(1);
        }
    };

    DockingManager.prototype.dockAllSnappedWindows = function() {

        for (var name in _snappedWindows) {

            var currentWindow = _snappedWindows[name];
            if (!currentWindow) {

                delete _snappedWindows[name];
                continue;
            }
            _snappedWindows[name] = null;
            this._addWindowToTheGroup(currentWindow[0], currentWindow[1], currentWindow[2]);
        }
    };

    DockingManager.prototype._addWindowToTheGroup = function(window1, windowGroup, position) {

        window1.setOpacity(1);
        windowGroup.setOpacity(1);
        window1.joinGroup(windowGroup, window1.onDock);
    };

    return DockingManager;

})();


