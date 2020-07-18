import { 
    Disposing, $isNothing, $isPromise,
    $decorated, getPropertyDescriptors,
    pcopy, createKey
} from "miruken-core";

import { 
    Lifestyle, LifestyleProvider, filter,
    QualifierConstraint, ConstraintProvider,
    createFilterDecorator 
} from "miruken-callback";

import { Context } from "./context";
import { Contextual } from "./contextual";

const _ = createKey();

export class ContextualLifestyle extends Lifestyle {
    constructor() {
        super();
        _(this).cache = new Map();
    }

    isCompatibleWithParent(parent, { provider }) {
        const parentBinding = parent.binding;
        if ($isNothing(parentBinding)) return true;
        const parentFilters = parentBinding.getMetadata(filter);
        if ($isNothing(parentFilters)) return true;
        const rooted     = provider.rooted,
              lifestyles = parentFilters.filters.filter(isLifestyleProvider);
        for (let lifestyle of lifestyles) {
            if (!(lifestyle instanceof ContextualLifestyleProvider) ||
                (!rooted && lifestyle.rooted)) {
                return false;
            }
        }
    }

    getInstance(inquiry, { provider, composer, next, abort }) {
        let context = $decorated(composer.resolve(Context), true);
        if ($isNothing(context)) return;
        if (provider.rooted) {
            context = context.root;
        }

        const cache = _(this).cache;
        if (cache.has(context)) {
            return cache.get(context);
        }

        let instance = next();

        if ($isPromise(instance)) {
            instance = instance.then(result => {
                result = bindContext(result, context, cache);
                cache.set(context, result);
                return result;
            });
        } else {
            instance = bindContext(instance, context, cache);
        }

        cache.set(context, instance);
        return instance;
    }
}

function isLifestyleProvider(filter) {
    return filter instanceof LifestyleProvider;
}

function bindContext(instance, context, cache) {
    if (Contextual.isAdoptedBy(instance)) {
        if (!$isNothing(instance.context)) {
            throw new Error("The instance has a Context already assigned.");
        }
        const managed  = pcopy(instance),
              contextp = getPropertyDescriptors(managed, "context"),
              { get = getContext, set = setContext } = contextp || {};
        
        set.call(managed, context);
        Object.defineProperty(managed, "context", {
            get() { return get.call(managed); },
            set(value) {
                if (value != null) {
                    if (get.call(managed) == null) {
                        throw new Error("The managed contextual instance has been evicted.");
                    }
                    if (value !== context) {
                        throw new Error("The managed contextual instance cannot change context.");
                    }
                } else if (cache.get(context) === managed) {
                    cache.delete(context);
                    set.call(managed, null);
                    Disposing.dispose(managed);
                }
            }
        });
        context.observe({
            contextEnded(ctx) { managed.context = null; }
        });
        return managed;
    }
    context.observe({
        contextEnded(ctx) {
            cache.delete(ctx);
            Disposing.dispose(instance);
        }
    });
    return instance;
}

const ContextField = Symbol();

function getContext() {
    return this[ContextField];
}

function setContext(context) {
    const field = this[ContextField];
    if (field === context) return;
    if (field) {
        field.removeHandlers(this);
    }
    if (context) {
        this[ContextField] = context;
        context.insertHandlers(0, this);
    } else {
        delete this[ContextField];
    }
}

export class ContextualLifestyleProvider extends LifestyleProvider {
    constructor(rooted) {
        super(new ContextualLifestyle());
        _(this).rooted = rooted;
    }

    get rooted() { return _(this).rooted; }
}

export const scopedQualifier = new QualifierConstraint();

const scopedProvider          = new ConstraintProvider(scopedQualifier),
      provideContextual       = [new ContextualLifestyleProvider(false), scopedProvider],
      provideRootedContextual = [new ContextualLifestyleProvider(true), scopedProvider];

export const scoped = createFilterDecorator(
    (target, key, descriptor, [rooted]) => 
        rooted === true ? provideRootedContextual : provideContextual);

export const scopedRooted = createFilterDecorator(
    (target, key, descriptor) => provideRootedContextual);

