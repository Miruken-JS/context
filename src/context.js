import {
    Enum, Protocol, Parenting, Disposing,
    Traversing, TraversingAxis, TraversingMixin,
    $isSomething, $isNothing, $classOf, $equals,
    $decorated, assignID
} from 'miruken-core';

import {
    Composition, CompositeCallbackHandler, $provide
} from 'miruken-callback';

const Axis = Symbol();

/**
 * Represents the state of a {{#crossLink "miruken.context.Context"}}{{/crossLink}}.
 * @class ContextState
 * @extends miruken.Enum
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
 * {{#crossLink "miruken.context.Context"}}{{/crossLink}}.
 * @class ContextObserver
 * @extends miruken.Protocol
 */
export const ContextObserver = Protocol.extend({
    /**
     * Called when a context is in the process of ending.
     * @method contextEnding
     * @param   {miruken.context.Context}  context
     */
    contextEnding(context) {},
    /**
     * Called when a context has ended.
     * @method contextEnded
     * @param   {miruken.context.Context}  context
     */        
    contextEnded(context) {},
    /**
     * Called when a child context is in the process of ending.
     * @method childContextEnding
     * @param   {miruken.context.Context}  childContext
     */
    childContextEnding(childContext) {},
    /**
     * Called when a child context has ended.
     * @method childContextEnded
     * @param   {miruken.context.Context}  childContext
     */        
    childContextEnded(context) {}
});

/**
 * A Context represents the scope at a give point in time.<br/>
 * It has a beginning and an end and can handle callbacks as well as notify observers of lifecycle changes.<br/>
 * In addition, it maintains parent-child relationships and thus can participate in a hierarchy.
 * @class Context
 * @constructor
 * @param   {miruken.context.Context}  [parent]  -  parent context
 * @extends miruken.callback.CompositeCallbackHandler
 * @uses miruken.Parenting
 * @uses miruken.graph.Traversing
 * @uses miruken.graph.TraversingMixin
 * @uses miruken.Disposing
 */    
export const Context = CompositeCallbackHandler.extend(
    Parenting, Traversing, Disposing, TraversingMixin, {
        constructor(parent) {
            this.base();

            const _id      = assignID(this),
                  _parent  = parent;
            
            let   _state   = ContextState.Active,
                 _children = [], 
                 _observers;

            this.extend({
                /**
                 * Gets the unique id of this context.
                 * @property {string} id
                 * @readOnly
                 */
                get id() { return _id },
                /**
                 * Gets the context state.
                 * @property {miruken.context.ContextState} state
                 * @readOnly
                 */
                get state() { return _state; },
                /**
                 * Gets the parent context.
                 * @property {miruken.context.Context} parent
                 * @readOnly
                 */                
                get parent() { return _parent; },
                /**
                 * Gets the context children.
                 * @property {Array} children
                 * @readOnly
                 */                                
                get children() { return _children.slice(); },
                /**
                 * Determines if the context has children.
                 * @property {boolean} hasChildren
                 * @readOnly
                 */                                                
                get hasChildren() { return _children.length > 0; },
                /**
                 * Gets the root context.
                 * @property {miruken.context.Context} root
                 * @readOnly
                 */                                
                get root() {
                    let root = this, parent;    
                    while (root && (parent = root.parent)) {
                        root = parent;
                    }
                    return root;
                },
                newChild() {
                    ensureActive();
                    const childContext = new ($classOf(this))(this).extend({
                        end() {
                            const index = _children.indexOf(childContext);
                            if (index < 0) return;
                            const notifier = makeNotifier();
                            notifier.childContextEnding(childContext);
                            _children.splice(index, 1);
                            this.base();
                            notifier.childContextEnded(childContext);                            
                        }
                    });
                    _children.push(childContext);
                    return childContext;
                },
                /**
                 * Stores the object in the context.
                 * @method store
                 * @param  {Object} object  -  object to store
                 * @returns {miruken.context.Context} receiving context.
                 * @chainable
                 */                                                
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
                        if (handled && !greedy) {
                            return true;
                        }
                        if (_parent) {
                            handled = handled | _parent.handle(callback, greedy, composer);
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
                /**
                 * Handles the callback using the traversing axis.
                 * @method handleAxis
                 * @param   {miruken.graph.TraversingAxis}     axis            -  any callback
                 * @param   {Object}                           callback        -  any callback
                 * @param   {boolean}                          [greedy=false]  -  true if handle greedily
                 * @param   {miruken.callback.CallbackHandler} [composer]      -  composition handler
                 * @returns {boolean} true if the callback was handled, false otherwise.
                 */                
                handleAxis(axis, callback, greedy, composer) {
                    if (!(axis instanceof TraversingAxis)) {
                        throw new TypeError("Invalid axis type supplied");
                    }        
                    this[Axis] = axis;
                    return this.handle(callback, greedy, composer);
                },
                /**
                 * Subscribes to the context notifications.
                 * @method observe
                 * @param   {miruken.context.ContextObserver}  observer  -  receives notifications
                 * @returns {Function} unsubscribes from context notifications.
                 */                                
                observe(observer) {
                    ensureActive();
                    if ($isNothing(observer)) return;
                    (_observers || (_observers = [])).push(observer);
                    return () => {
                        const index = _observers.indexOf(observer);
                        if (index >= 0) {
                            _observers.splice(index, 1);
                        }
                    };
                },
                /**
                 * Unwinds to the root context.
                 * @method unwindToRootContext
                 * @param   {miruken.context.ContextObserver}  observer  -  receives notifications
                 * @returns {miruken.context.Context} receiving context.
                 * @chainable
                 */                                                
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
                /**
                 * Unwinds to the context by ending all children.
                 * @method unwind
                 * @returns {miruken.context.Context} receiving context.
                 * @chainable
                 */
                unwind() {
                    for (const child of this.children) {
                        child.end();
                    }
                    return this;
                },
                /**
                 * Ends the context.
                 * @method end
                 */                                                                                end() { 
                    if (_state == ContextState.Active) {
                        const notifier = makeNotifier();
                        _state = ContextState.Ending;
                        notifier.contextEnding(this);
                        this.unwind();
                        _state = ContextState.Ended;
                        notifier.contextEnded(this);                        
                        _observers = null;
                    }
                },
                dispose() { this.end(); }
            });

            function ensureActive() {
                if (_state != ContextState.Active) {
                    throw new Error("The context has already ended.");
                }
            }

            function makeNotifier() {
                return new ContextObserver(_observers && _observers.slice());
            }
        }
});

const axisControl = {
    /**
     * Changes the default traversal axis.
     * @method axis
     * @param   {miruken.graph.TraversingAxis}  axis  -  axis
     * @returns {miruken.context.Context} callback handler axis.
     * @for miruken.context.Context
     */
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
    }},
    applyAxis = axisControl.axis;

TraversingAxis.items.forEach(axis => {
    const key = '$' + axis.name.charAt(0).toLowerCase() + axis.name.slice(1);
    axisControl[key] = function () { return this.axis(axis); }
});

Context.implement(axisControl);

/**
 * Sets the default traversal axis to
 * {{#crossLink "miruken.graph.TraversingAxis/Self:property"}}{{/crossLink}}.
 * @method $self
 * @returns {miruken.context.Context} default traversal axis.
 * @for miruken.context.Context
 */

/**
 * Sets the default traversal axis to
 * {{#crossLink "miruken.graph.TraversingAxis/Root:property"}}{{/crossLink}}.
 * @method $root
 * @returns {miruken.context.Context} default traversal axis.
 * @for miruken.context.Context
 */

/**
 * Sets the default traversal axis to
 * {{#crossLink "miruken.graph.TraversingAxis/Child:property"}}{{/crossLink}}.
 * @method $child
 * @returns {miruken.context.Context} default traversal axis.
 * @for miruken.context.Context
 */

/**
 * Sets the default traversal axis to
 * {{#crossLink "miruken.graph.TraversingAxis/Sibling:property"}}{{/crossLink}}.
 * @method $sibling
 * @returns {miruken.context.Context} default traversal axis.
 * @for miruken.context.Context
 */

/**
 * Sets the default traversal axis to
 * {{#crossLink "miruken.graph.TraversingAxis/Ancestor:property"}}{{/crossLink}}.
 * @method $ancestor
 * @returns {miruken.context.Context} default traversal axis.
 * @for miruken.context.Context
 */

/**
 * Sets the default traversal axis to
 * {{#crossLink "miruken.graph.TraversingAxis/Descendant:property"}}{{/crossLink}}.
 * @method $descendant
 * @returns {miruken.context.Context} default traversal axis.
 * @for miruken.context.Context
 */

/**
 * Sets the default traversal axis to
 * {{#crossLink "miruken.graph.TraversingAxis/DescendantReverse:property"}}{{/crossLink}}.
 * @method $descendantReverse
 * @returns {miruken.context.Context} default traversal axis.
 * @for miruken.context.Context
 */        

/**
 * Sets the default traversal axis to
 * {{#crossLink "miruken.graph.TraversingAxis/ChildOrSelf:property"}}{{/crossLink}}.
 * @method $childOrSelf
 * @returns {miruken.context.Context} default traversal axis.
 * @for miruken.context.Context
 */

/**
 * Sets the default traversal axis to
 * {{#crossLink "miruken.graph.TraversingAxis/SiblingOrSelf:property"}}{{/crossLink}}.
 * @method $siblingOrSelf
 * @returns {miruken.context.Context} default traversal axis.
 * @for miruken.context.Context
 */

/**
 * Sets the default traversal axis to
 * {{#crossLink "miruken.graph.TraversingAxis/AncestorOrSelf:property"}}{{/crossLink}}.
 * @method $ancestorOrSelf
 * @returns {miruken.context.Context} default traversal axis.
 * @for miruken.context.Context
 */        

/**
 * Sets the default traversal axis to
 * {{#crossLink "miruken.graph.TraversingAxis/DescendantOrSelf:property"}}{{/crossLink}}.
 * @method $descendantOrSelf
 * @returns {miruken.context.Context} default traversal axis.
 * @for miruken.context.Context
 */

/**
 * Sets the default traversal axis to
 * {{#crossLink "miruken.graph.TraversingAxis/DescendantOrSelfReverse:property"}}{{/crossLink}}.
 * @method $descendantOrSelfReverse
 * @returns {miruken.context.Context} default traversal axis.
 * @for miruken.context.Context
 */

/**
 * Sets the default traversal axis to
 * {{#crossLink "miruken.graph.TraversingAxis/AncestorSiblingOrSelf:property"}}{{/crossLink}}.
 * @method $ancestorSiblingOrSelf
 * @returns {miruken.context.Context} default traversal axis.
 * @for miruken.context.Context
 */
