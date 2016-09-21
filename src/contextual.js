import { ContextualMixin } from "./mixin";

/**
 * Decorator to make classes contextual.<br/>
 * <pre>
 *    const Controller = Base.extend(contextual, {
 *       action: function () {}
 *    })
 * </pre>
 * would give the Controller class contextual support.
 * @method contextual
 * @param {Function}  target  -  target to contextualize
 */    
export function contextual(target) {
    target.implement(ContextualMixin);    
}
