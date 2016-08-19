/**
 * Enhances Functions to create instances in a context.
 * @method newInContext
 * @for Function
 */
if (Function.prototype.newInContext === undefined)
    Function.prototype.newInContext = function () {
        var args        = Array.prototype.slice.call(arguments),
            context     = args.shift(),
            constructor = this;
        function Fake() { constructor.apply(this, args); }
        Fake.prototype  = constructor.prototype;
        var object      = new Fake;
        ContextualHelper.bindContext(object, context);
        return object;
    };

/**
 * Enhances Functions to create instances in a child context.
 * @method newInChildContext
 * @for Function
 */
if (Function.prototype.newInChildContext === undefined)
    Function.prototype.newInChildContext = function () {
        var args        = Array.prototype.slice.call(arguments),
            context     = args.shift(),
            constructor = this;
        function Fake() { constructor.apply(this, args); }
        Fake.prototype  = constructor.prototype;
        var object      = new Fake;
        ContextualHelper.bindChildContext(context, object);
        return object;
    };
