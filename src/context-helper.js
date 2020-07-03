import { Module, $isNothing } from "miruken-core";
import { ContextState, Context } from "./context";

/**
 * Mixin for {{#crossLink "Contextual"}}{{/crossLink}} helper support.
 * @class ContextualHelper
 * @extends Module
 */    
export class ContextualHelper {
    /**
     * Resolves the receivers context.
     * @method resolveContext
     * @returns {Context} receiver if a context or the receiver context. 
     */                
    static resolveContext(contextual) {
        return $isNothing(contextual) || (contextual instanceof Context)
             ? contextual
             : contextual.context;
    }

    /**
     * Ensure the receiver is associated with a context.
     * @method requireContext
     * @throws {Error} an error if a context could not be resolved.
     */                        
    static requireContext(contextual) {
        const context = ContextualHelper.resolveContext(contextual);
        if (!(context instanceof Context))
            throw new Error("The supplied object is not a Context or Contextual object.");
        return context;
    }

    /**
     * Clears and ends the receivers associated context.
     * @method clearContext
     */                                
    static clearContext(contextual) {
        const context = contextual.context;
        if (context) {
            try {
                context.end();
            }
            finally {
                contextual.context = null;
            }
        }
    }

    /**
     * Attaches the context to the receiver.
     * @method bindContext
     * @param  {Context}  context  -  context
     * @param  {boolean}  replace  -  true if replace existing context
     * @returns {Context} effective context.
     * @throws {Error} an error if the context could be attached.
     */                                        
    static bindContext(contextual, context, replace) {
        if (contextual && (replace || !contextual.context)) {
            contextual.context = ContextualHelper.resolveContext(context);
        }
        return contextual;
    }

    /**
     * Attaches a child context of the receiver to the contextual child.
     * @method bindChildContext
     * @param  {Context}  child    -  contextual child
     * @param  {boolean}  replace  -  true if replace existing context
     * @returns {Context} effective child context.
     * @throws {Error} an error if the child context could be attached.
     */                                                
    static bindChildContext(contextual, child, replace) {
        let childContext;
        if (child) {
            if (!replace) {
                childContext = child.context;
                if (childContext && childContext.state === ContextState.Active) {
                    return childContext;
                }
            }
            let context = ContextualHelper.requireContext(contextual);
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
}
