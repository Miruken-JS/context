import {
    Enum, Protocol, Parenting, Disposing,
    Traversing, TraversingAxis, TraversingMixin,
    $isSomething, $isNothing, $classOf, $equals,
    $decorated, assignID, createKeyChain
} from "miruken-core";

import {
    Composition, CompositeHandler, $provide
} from "miruken-callback";

const _ = createKeyChain();

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
            _(this).id        = assignID(this);
            _(this).parent    = parent;
            _(this).state     = ContextState.Active;
            _(this).children  = [];
            _(this).observers = [];
        },

        get id()          { return _(this).id },
        get state()       { return _(this).state; },              
        get parent()      { return _(this).parent; },                              
        get children()    { return _(this).children.slice(); },                                            
        get hasChildren() { return _(this).children.length > 0; },                             
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
                    const index = _(parent).children.indexOf(childContext);
                    if (index < 0) return;
                    const notifier = makeNotifier.call(parent);
                    notifier.childContextEnding(childContext);
                    _(parent).children.splice(index, 1);
                    this.base();
                    notifier.childContextEnded(childContext);                            
                }
            });
            _(this).children.push(childContext);
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
                axis    = _(this).axis;
            if (!axis) {
                handled = this.base(callback, greedy, composer);
                if (handled && !greedy) { return true; }
                if (this.parent) {
                    handled = handled | this.parent.handle(callback, greedy, composer);
                }
                return !!handled;                        
            }
            delete _(this).axis;
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
            _(this).axis = axis;
            return this.handle(callback, greedy, composer);
        },                              
        observe(observer) {
            ensureActive.call(this);
            if ($isNothing(observer)) return;
            _(this).observers.push(observer);
            return () => {
                const index = _(this).observers.indexOf(observer);
                if (index >= 0) {
                    _(this).observers.splice(index, 1);
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
            if (_(this).state == ContextState.Active) {
                const notifier = makeNotifier.call(this);
                _(this).state = ContextState.Ending;
                notifier.contextEnding(this);
                this.unwind();
                _(this).state = ContextState.Ended;
                notifier.contextEnded(this);                        
                _(this).observers = null;
            }
        },      
        dispose() { this.end(); }    
});

function ensureActive() {
    if (_(this).state != ContextState.Active) {
        throw new Error("The context has already ended.");
    }
}

function makeNotifier() {
    return new ContextObserver(_(this).observers.slice());
}

const axisBuilder = {
    axis(axis) {
        return this.decorate({
            handleCallback(callback, greedy, composer) {
                if (!(callback instanceof Composition)) {
                    _(this).axis = axis;                        
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
