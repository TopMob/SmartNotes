const AUTH_METHODS = Object.freeze(["popup"])

export function planAuthMethods() {
    return {
        methods: [...AUTH_METHODS]
    }
}
