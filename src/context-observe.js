import { Context } from "./context";

Context.implement({
    /**
     * Observes 'contextEnding' notification.
     * @method onEnding
     * @param   {Function}  observer  -  receives notification
     * @returns {Function}  unsubscribes from 'contextEnding' notification.
     * @for Context
     */
    onEnding(observer) {
        return this.observe({contextEnding: observer});
    },
    /**
     * Observes 'contextEnded' notification.
     * @method onEnded
     * @param   {Function}  observer  -  receives notification
     * @returns {Function}  unsubscribes from 'contextEnded' notification.
     * @for Context
     * @chainable
     */        
    onEnded(observer) {
        return this.observe({contextEnded: observer});
    },
    /**
     * Observes 'childContextEnding' notification.
     * @method onChildEnding
     * @param   {Function}  observer  -  receives notification
     * @returns {Function}  unsubscribes from 'childContextEnding' notification.
     * @for Context
     * @chainable
     */                
    onChildEnding(observer) {
        return this.observe({childContextEnding: observer});
    },
    /**
     * Observes 'childContextEnded' notification.
     * @method onChildEnded
     * @param   {Function}  observer  -  receives notification
     * @returns {Function}  unsubscribes from 'childContextEnded' notification.
     * @for Context
     * @chainable
     */                        
    onChildEnded(observer) {
        return this.observe({childContextEnded: observer});            
    }        
});
