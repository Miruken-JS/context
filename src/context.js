import {
    Enum, Protocol, Parenting, Disposing,
    Traversing, TraversingAxis, TraversingMixin,
    $isSomething, $isNothing, $classOf, $equals,
    $decorated, assignID
} from "miruken-core";

import {
    Composition, CompositeHandler, $provide
} from "miruken-callback";

const Axis = Symbol();

/**
 * Represents the state of a {{#crossLink "Context"}}{{/crossLink}}.
 * @class ContextState
 * @extends Enum
 */
export const ContextState = Enum({
    /**
     * Context is active.
     * @property {number} Active
     */
    Active: 1,
    /**
     * Context is in the process of ending.
     * @property {number} Ending
     */        
    Ending: 2,
    /**
     * Context has ended.
     * @property {number} Ended
     */                
    Ended:  3 
});

/**
 * Protocol for observing the lifecycle of
 * {{#crossLink "Context"}}{{/crossLink}}.
 * @class ContextObserver
 * @extends Protocol
 */
export const ContextObserver = Protocol.extend({
    /**
     * Called when a context is in the process of ending.
     * @method contextEnding
     * @param  {Context}  context
     */
    contextEnding(context) {},
    /**
     * Called when a context has ended.
     * @method contextEnded
     * @param  {Context}  context
     */        
    contextEnded(context) {},
    /**
     * Called when a child context is in the process of ending.
     * @method childContextEnding
     * @param  {Context}  childContext
     */
    childContextEnding(childContext) {},
    /**
     * Called when a child context has ended.
     * @method childContextEnded
     * @param  {Context}  childContext
     */        
    childContextEnded(context) {}
});

/**
 * A Context represents the scope at a give point in time.<br/>
 * It has a beginning and an end and can handle callbacks as well as notify observers of lifecycle changes.<br/>
 * In addition, it maintains parent-child relationships and thus can participate in a hierarchy.
 * @class Context
 * @constructor
 * @param  {Context}  [parent]  -  parent context
 * @extends CompositeHandler
 * @uses Parenting
 * @uses Traversing
 * @uses TraversingMixin
 * @uses Disposing
 */    
export const Context = CompositeHandler.extend(
    Parenting, Traversing, Disposing, TraversingMixin, {
        constructor(parent) {
            this.base();
            this._id     = assignID(this);
            this._parent = parent;
            this._state  = ContextState.Active;
            this._children = [];
        },
        get id() { return this._id },
        get state() { return this._state; },              
        get parent() { return this._parent; },                              
        get children() { return this._children.slice(); },                                            
        get hasChildren() { return this._children.length > 0; },                             
        get root() {
            let root = this, parent;    
            while (root && (parent = root.parent)) {
                root = parent;
            }
            return root;
        },
        newChild() {
            ensureActive.call(this);
            const parent       = this,
                  childContext = new ($classOf(this))(this).extend({
                end() {
                    const index = parent._children.indexOf(childContext);
                    if (index < 0) return;
                    const notifier = makeNotifier.call(parent);
                    notifier.childContextEnding(childContext);
                    parent._children.splice(index, 1);
                    this.base();
                    notifier.childContextEnded(childContext);                            
                }
            });
            this._children.push(childContext);
            return childContext;
        },                                              
        store(object) {
            if ($isSomething(object)) {
                $provide(this, object);
            }
            return this;
        },
        handleCallback(callback, greedy, composer) {
            let handled = false,
                axis    = this[Axis];
            if (!axis) {
                handled = this.base(callback, greedy, composer);
                if (handled && !greedy) { return true; }
                if (this.parent) {
                    handled = handled | this.parent.handle(callback, greedy, composer);
                }
                return !!handled;                        
            }
            delete this[Axis];
            if (axis === TraversingAxis.Self) {
                return this.base(callback, greedy, composer);
            } else {
                this.traverse(axis, node => {
                    handled = handled | ($equals(node, this)
                            ? this.base(callback, greedy, composer)
                            : node.handleAxis(TraversingAxis.Self, callback, greedy, composer));
                    return handled && !greedy;
                }, this);
            }
            return !!handled;
        },           
        handleAxis(axis, callback, greedy, composer) {
            if (!(axis instanceof TraversingAxis)) {
                throw new TypeError("Invalid axis type supplied.");
            }        
            this[Axis] = axis;
            return this.handle(callback, greedy, composer);
        },                              
        observe(observer) {
            ensureActive.call(this);
            if ($isNothing(observer)) return;
            const observers = this._observers || (this._observers = []);
            observers.push(observer);
            return () => {
                const index = this._observers.indexOf(observer);
                if (index >= 0) {
                    this._observers.splice(index, 1);
                }
            };
        },                                             
        unwindToRootContext() {
            let current = this;
            while (current) {
                const parent = current.parent;
                if (parent == null) {
                    current.unwind();
                    return current;
                }
                current = parent;
            }
            return this;
        },
        unwind() {
            for (const child of this.children) {
                child.end();
            }
            return this;
        },
        end() { 
            if (this._state == ContextState.Active) {
                const notifier = makeNotifier.call(this);
                this._state = ContextState.Ending;
                notifier.contextEnding(this);
                this.unwind();
                this._state = ContextState.Ended;
                notifier.contextEnded(this);                        
                this._observers = null;
            }
        },      
        dispose() { this.end(); }    
});

function ensureActive() {
    if (this._state != ContextState.Active) {
        throw new Error("The context has already ended.");
    }
}

function makeNotifier() {
    const observers = this._observers;
    return new ContextObserver(observers && observers.slice());
}

const axisBuilder = {
    axis(axis) {
        return this.decorate({
            handleCallback(callback, greedy, composer) {
                if (!(callback instanceof Composition)) {
                    this[Axis]= axis;                        
                }
                return this.base(callback, greedy, composer);
            },
            equals(other) {
                return (this === other) || ($decorated(this) === $decorated(other));
            }
        });
    }
};

TraversingAxis.items.forEach(axis => {
    const key = "$" + axis.name.charAt(0).toLowerCase() + axis.name.slice(1);
    axisBuilder[key] = function () { return this.axis(axis); }
});

Context.implement(axisBuilder);
