import assert from 'assert';
import { DockingManager } from '../DockingManager';

describe('DockingManager', function() {
    let dockingManager;

    beforeEach(() => {
        dockingManager = new DockingManager();
    });

    describe('init', function() {

        describe('full', function() {
            beforeEach(() => {
                dockingManager.init({
                    spacing: 25,
                    range: 35,
                    undockOffsetX: 5,
                    undockOffsetY: 5
                });
            });

            it('should set initial values correctly', function() {
                assert.equal(dockingManager.spacing, 25);
                assert.equal(dockingManager.range, 35);
                assert.equal(dockingManager.undockOffsetX, 5);
                assert.equal(dockingManager.undockOffsetY, 5);
            });
        });

        describe('partial', function() {
            beforeEach(() => {
                dockingManager.init({
                    spacing: 20,
                    range: 30
                });
            });

            it('should set initial values correctly', function() {
                assert.equal(dockingManager.spacing, 20);
                assert.equal(dockingManager.range, 30);
                assert.equal(dockingManager.undockOffsetX, 0);
                assert.equal(dockingManager.undockOffsetY, 0);
            });
        });

        describe('invalid', function() {
            beforeEach(() => {
                dockingManager.init({
                    spacing: 'BIG',
                    range: -5
                });
            });

            it('should set initial values correctly', function() {
                assert.equal(dockingManager.spacing, 5);
                assert.equal(dockingManager.range, 40);
                assert.equal(dockingManager.undockOffsetX, 0);
                assert.equal(dockingManager.undockOffsetY, 0);
            });
        });
    });
});