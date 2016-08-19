'use strict';

System.register(['miruken-core', 'miruken-callback'], function (_export, _context) {
    "use strict";

    var Enum, Protocol, Parenting, Disposing, Traversing, TraversingAxis, TraversingMixin, $isSomething, $isNothing, $classOf, $equals, $decorated, assignID, Module, Composition, CompositeCallbackHandler, $provide, CallbackHandler, Axis, ContextState, ContextObserver, Context, axisControl, applyAxis, ContextualHelper, ContextField, ContextualMixin;
    return {
        setters: [function (_mirukenCore) {
            Enum = _mirukenCore.Enum;
            Protocol = _mirukenCore.Protocol;
            Parenting = _mirukenCore.Parenting;
            Disposing = _mirukenCore.Disposing;
            Traversing = _mirukenCore.Traversing;
            TraversingAxis = _mirukenCore.TraversingAxis;
            TraversingMixin = _mirukenCore.TraversingMixin;
            $isSomething = _mirukenCore.$isSomething;
            $isNothing = _mirukenCore.$isNothing;
            $classOf = _mirukenCore.$classOf;
            $equals = _mirukenCore.$equals;
            $decorated = _mirukenCore.$decorated;
            assignID = _mirukenCore.assignID;
            Module = _mirukenCore.Module;
        }, function (_mirukenCallback) {
            Composition = _mirukenCallback.Composition;
            CompositeCallbackHandler = _mirukenCallback.CompositeCallbackHandler;
            $provide = _mirukenCallback.$provide;
            CallbackHandler = _mirukenCallback.CallbackHandler;
        }],
        execute: function () {
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

            Axis = Symbol();

            _export('ContextState', ContextState = Enum({
                Active: 1,

                Ending: 2,

                Ended: 3
            }));

            _export('ContextState', ContextState);

            _export('ContextObserver', ContextObserver = Protocol.extend({
                contextEnding: function contextEnding(context) {},
                contextEnded: function contextEnded(context) {},
                childContextEnding: function childContextEnding(childContext) {},
                childContextEnded: function childContextEnded(context) {}
            }));

            _export('ContextObserver', ContextObserver);

            _export('Context', Context = CompositeCallbackHandler.extend(Parenting, Traversing, Disposing, TraversingMixin, {
                constructor: function constructor(parent) {
                    this.base();

                    var _id = assignID(this),
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
                            var childContext = new ($classOf(this))(this).extend({
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
                            if ($isSomething(object)) {
                                $provide(this, object);
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
                            if (axis === TraversingAxis.Self) {
                                return this.base(callback, greedy, composer);
                            } else {
                                this.traverse(axis, function (node) {
                                    handled = handled | ($equals(node, _this) ? _this.base(callback, greedy, composer) : node.handleAxis(TraversingAxis.Self, callback, greedy, composer));
                                    return handled && !greedy;
                                }, this);
                            }
                            return !!handled;
                        },
                        handleAxis: function handleAxis(axis, callback, greedy, composer) {
                            if (!(axis instanceof TraversingAxis)) {
                                throw new TypeError("Invalid axis type supplied");
                            }
                            this[Axis] = axis;
                            return this.handle(callback, greedy, composer);
                        },
                        observe: function observe(observer) {
                            ensureActive();
                            if ($isNothing(observer)) return;
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
            }));

            _export('Context', Context);

            axisControl = {
                axis: function axis(_axis) {
                    return this.decorate({
                        handleCallback: function handleCallback(callback, greedy, composer) {
                            if (!(callback instanceof Composition)) {
                                this[Axis] = _axis;
                            }
                            return this.base(callback, greedy, composer);
                        },
                        equals: function equals(other) {
                            return this === other || $decorated(this) === $decorated(other);
                        }
                    });
                }
            };
            applyAxis = axisControl.axis;


            TraversingAxis.items.forEach(function (axis) {
                var key = '$' + axis.name.charAt(0).toLowerCase() + axis.name.slice(1);
                axisControl[key] = function () {
                    return this.axis(axis);
                };
            });

            Context.implement(axisControl);

            _export('ContextualHelper', ContextualHelper = Module.extend({
                resolveContext: function resolveContext(contextual) {
                    return $isNothing(contextual) || contextual instanceof Context ? contextual : contextual.context;
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
            }));

            _export('ContextualHelper', ContextualHelper);

            ContextField = Symbol();

            _export('ContextualMixin', ContextualMixin = Object.freeze({
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
                        context.addHandlers(this);
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
            }));

            _export('ContextualMixin', ContextualMixin);

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

            CallbackHandler.implement({
                $publish: function $publish() {
                    var composer = this;
                    var context = ContextualHelper.resolveContext(composer);
                    if (context) {
                        composer = context.$descendantOrSelf();
                    }
                    return composer.$notify();
                },
                $publishFromRoot: function $publishFromRoot() {
                    var composer = this;
                    var context = ContextualHelper.resolveContext(composer);
                    if (context) {
                        composer = context.root.$descendantOrSelf();
                    }
                    return composer.$notify();
                }
            });

            function contextual(target) {
                target.implement(ContextualMixin);
            }

            _export('contextual', contextual);
        }
    };
});