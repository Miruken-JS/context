import { ContextState } from "./context";
import { $composer } from "miruken-callback";

const ContextField = Symbol();

/**
 * Mixin to provide the minimal functionality to support contextual based operations.<br/>
 * This is an alternatve to the delegate model of communication, but with less coupling 
 * and ceremony.
 * @class ContextualMixin
 * @private
 */
export const ContextualMixin = {
    /**
     * The context associated with the receiver.
     * @property {Context} context
     */        
    get context() { return this[ContextField]; },
    set context(context) {
        const field = this[ContextField];
        if (field === context) { return; }
        if (field) {
            field.removeHandlers(this);
        }
        if (context) {
            this[ContextField] = context;
            context.insertHandlers(0, this);
        } else {
            delete this[ContextField];
        }
    },
    /**
     * Determines if the receivers context is active.
     * @property {boolean} isActiveContext
     * @readOnly
     */        
    get isActiveContext() {
        const field = this[ContextField];
        return field && (field.state === ContextState.Active);
    },
    /**
     * Ends the callers context.
     * @method endCallingContext
     */
    endCallingContext() {
        const composer = $composer;
        if (!composer) { return; }
        const context = composer.resolve(Context);
        if (context && (context !== this.context)) {
            context.End();
        }
    },    
    /**
     * Ends the receivers context.
     * @method endContext
     */                
    endContext() {
        const field = this[ContextField];        
        if (field) field.end();
    }
};
