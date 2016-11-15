define(['exports', 'miruken-core', 'miruken-callback'], function (exports, _mirukenCore, _mirukenCallback) {
    'use strict';

    Object.defineProperty(exports, "__esModule", {
        value: true
    });
    exports.ContextualMixin = exports.ContextualHelper = exports.Context = exports.ContextObserver = exports.ContextState = undefined;
    exports.contextual = contextual;

    if (Function.prototype.newInContext === undefined) Function.prototype.newInContext = function () {
        var args = Array.prototype.slice.call(arguments),
            context = args.shift(),
            constructor = this;
        function Fake() {
            constructor.apply(this, args);
        }
        Fake.prototype = constructor.prototype;
        var object = new Fake();
        ContextualHelper.bindContext(object, context);
        return object;
    };

    if (Function.prototype.newInChildContext === undefined) Function.prototype.newInChildContext = function () {
        var args = Array.prototype.slice.call(arguments),
            context = args.shift(),
            constructor = this;
        function Fake() {
            constructor.apply(this, args);
        }
        Fake.prototype = constructor.prototype;
        var object = new Fake();
        ContextualHelper.bindChildContext(context, object);
        return object;
    };

    var Axis = Symbol();

    var ContextState = exports.ContextState = (0, _mirukenCore.Enum)({
        Active: 1,

        Ending: 2,

        Ended: 3
    });

    var ContextObserver = exports.ContextObserver = _mirukenCore.Protocol.extend({
        contextEnding: function contextEnding(context) {},
        contextEnded: function contextEnded(context) {},
        childContextEnding: function childContextEnding(childContext) {},
        childContextEnded: function childContextEnded(context) {}
    });

    var Context = exports.Context = _mirukenCallback.CompositeHandler.extend(_mirukenCore.Parenting, _mirukenCore.Traversing, _mirukenCore.Disposing, _mirukenCore.TraversingMixin, {
        constructor: function constructor(parent) {
            this.base();

            var _id = (0, _mirukenCore.assignID)(this),
                _parent = parent;

            var _state = ContextState.Active,
                _children = [],
                _observers = void 0;

            this.extend({
                get id() {
                    return _id;
                },

                get state() {
                    return _state;
                },

                get parent() {
                    return _parent;
                },

                get children() {
                    return _children.slice();
                },

                get hasChildren() {
                    return _children.length > 0;
                },

                get root() {
                    var root = this,
                        parent = void 0;
                    while (root && (parent = root.parent)) {
                        root = parent;
                    }
                    return root;
                },
                newChild: function newChild() {
                    ensureActive();
                    var childContext = new ((0, _mirukenCore.$classOf)(this))(this).extend({
                        end: function end() {
                            var index = _children.indexOf(childContext);
                            if (index < 0) return;
                            var notifier = makeNotifier();
                            notifier.childContextEnding(childContext);
                            _children.splice(index, 1);
                            this.base();
                            notifier.childContextEnded(childContext);
                        }
                    });
                    _children.push(childContext);
                    return childContext;
                },
                store: function store(object) {
                    if ((0, _mirukenCore.$isSomething)(object)) {
                        (0, _mirukenCallback.$provide)(this, object);
                    }
                    return this;
                },
                handleCallback: function handleCallback(callback, greedy, composer) {
                    var _this = this;

                    var handled = false,
                        axis = this[Axis];
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
                    if (axis === _mirukenCore.TraversingAxis.Self) {
                        return this.base(callback, greedy, composer);
                    } else {
                        this.traverse(axis, function (node) {
                            handled = handled | ((0, _mirukenCore.$equals)(node, _this) ? _this.base(callback, greedy, composer) : node.handleAxis(_mirukenCore.TraversingAxis.Self, callback, greedy, composer));
                            return handled && !greedy;
                        }, this);
                    }
                    return !!handled;
                },
                handleAxis: function handleAxis(axis, callback, greedy, composer) {
                    if (!(axis instanceof _mirukenCore.TraversingAxis)) {
                        throw new TypeError("Invalid axis type supplied");
                    }
                    this[Axis] = axis;
                    return this.handle(callback, greedy, composer);
                },
                observe: function observe(observer) {
                    ensureActive();
                    if ((0, _mirukenCore.$isNothing)(observer)) return;
                    (_observers || (_observers = [])).push(observer);
                    return function () {
                        var index = _observers.indexOf(observer);
                        if (index >= 0) {
                            _observers.splice(index, 1);
                        }
                    };
                },
                unwindToRootContext: function unwindToRootContext() {
                    var current = this;
                    while (current) {
                        var _parent2 = current.parent;
                        if (_parent2 == null) {
                            current.unwind();
                            return current;
                        }
                        current = _parent2;
                    }
                    return this;
                },
                unwind: function unwind() {
                    var _iteratorNormalCompletion = true;
                    var _didIteratorError = false;
                    var _iteratorError = undefined;

                    try {
                        for (var _iterator = this.children[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
                            var child = _step.value;

                            child.end();
                        }
                    } catch (err) {
                        _didIteratorError = true;
                        _iteratorError = err;
                    } finally {
                        try {
                            if (!_iteratorNormalCompletion && _iterator.return) {
                                _iterator.return();
                            }
                        } finally {
                            if (_didIteratorError) {
                                throw _iteratorError;
                            }
                        }
                    }

                    return this;
                },
                end: function end() {
                    if (_state == ContextState.Active) {
                        var notifier = makeNotifier();
                        _state = ContextState.Ending;
                        notifier.contextEnding(this);
                        this.unwind();
                        _state = ContextState.Ended;
                        notifier.contextEnded(this);
                        _observers = null;
                    }
                },
                dispose: function dispose() {
                    this.end();
                }
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

    var axisControl = {
        axis: function axis(_axis) {
            return this.decorate({
                handleCallback: function handleCallback(callback, greedy, composer) {
                    if (!(callback instanceof _mirukenCallback.Composition)) {
                        this[Axis] = _axis;
                    }
                    return this.base(callback, greedy, composer);
                },
                equals: function equals(other) {
                    return this === other || (0, _mirukenCore.$decorated)(this) === (0, _mirukenCore.$decorated)(other);
                }
            });
        }
    },
        applyAxis = axisControl.axis;

    _mirukenCore.TraversingAxis.items.forEach(function (axis) {
        var key = "$" + axis.name.charAt(0).toLowerCase() + axis.name.slice(1);
        axisControl[key] = function () {
            return this.axis(axis);
        };
    });

    Context.implement(axisControl);

    var ContextualHelper = exports.ContextualHelper = _mirukenCore.Module.extend({
        resolveContext: function resolveContext(contextual) {
            return (0, _mirukenCore.$isNothing)(contextual) || contextual instanceof Context ? contextual : contextual.context;
        },
        requireContext: function requireContext(contextual) {
            var context = ContextualHelper.resolveContext(contextual);
            if (!(context instanceof Context)) throw new Error("The supplied object is not a Context or Contextual object.");
            return context;
        },
        clearContext: function clearContext(contextual) {
            var context = contextual.context;
            if (context) {
                try {
                    context.end();
                } finally {
                    contextual.context = null;
                }
            }
        },
        bindContext: function bindContext(contextual, context, replace) {
            if (contextual && (replace || !contextual.context)) {
                contextual.context = ContextualHelper.resolveContext(context);
            }
            return contextual;
        },
        bindChildContext: function bindChildContext(contextual, child, replace) {
            var childContext = void 0;
            if (child) {
                if (!replace) {
                    childContext = child.context;
                    if (childContext && childContext.state === ContextState.Active) {
                        return childContext;
                    }
                }
                var context = ContextualHelper.requireContext(contextual);
                while (context && context.state !== ContextState.Active) {
                    context = context.parent;
                }
                if (context) {
                    childContext = context.newChild();
                    ContextualHelper.bindContext(child, childContext, true);
                }
            }
            return childContext;
        }
    });

    var ContextField = Symbol();

    var ContextualMixin = exports.ContextualMixin = {
        get context() {
            return this[ContextField];
        },
        set context(context) {
            var field = this[ContextField];
            if (field === context) {
                return;
            }
            if (field) this[ContextField].removeHandlers(this);
            if (context) {
                this[ContextField] = context;
                context.insertHandlers(0, this);
            } else {
                delete this[ContextField];
            }
        },

        get isActiveContext() {
            var field = this[ContextField];
            return field && field.state === ContextState.Active;
        },
        endContext: function endContext() {
            var field = this[ContextField];
            if (field) field.end();
        }
    };

    Context.implement({
        onEnding: function onEnding(observer) {
            return this.observe({ contextEnding: observer });
        },
        onEnded: function onEnded(observer) {
            return this.observe({ contextEnded: observer });
        },
        onChildEnding: function onChildEnding(observer) {
            return this.observe({ childContextEnding: observer });
        },
        onChildEnded: function onChildEnded(observer) {
            return this.observe({ childContextEnded: observer });
        }
    });

    _mirukenCallback.Handler.implement({
        $publish: function $publish() {
            var composer = this;
            var context = ContextualHelper.resolveContext(composer);
            if (context) {
                composer = context.$selfOrDescendant();
            }
            return composer.$notify();
        },
        $publishFromRoot: function $publishFromRoot() {
            var composer = this;
            var context = ContextualHelper.resolveContext(composer);
            if (context) {
                composer = context.root.$selfOrDescendant();
            }
            return composer.$notify();
        }
    });

    function contextual(target) {
        target.implement(ContextualMixin);
    }
});