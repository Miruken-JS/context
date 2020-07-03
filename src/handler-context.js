import { Handler } from "miruken-callback";
import { ContextualHelper } from "./context-helper";

Handler.implement({
    /**
     * Establishes publish invocation semantics.
     * @method $publish
     * @returns {Handler} publish semantics.
     * @for Handler
     */
    $publish() {
        let   composer = this;
        const context  = ContextualHelper.resolveContext(composer);
        if (context) {
            composer = context.$selfOrDescendant();
        }
        return composer.$notify();
    },
    $publishFromRoot() {
        let   composer = this;
        const context  = ContextualHelper.resolveContext(composer);
        if (context) {
            composer = context.root.$selfOrDescendant();
        }
        return composer.$notify();
    }
});
