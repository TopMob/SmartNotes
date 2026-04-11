const NotesApplication = (() => {
    const runtime = window.AppRuntimeInitializer.createRuntimeInitializer()
    return {
        init: runtime.init,
        initWhenDomReady: runtime.initWhenDomReady
    }
})()

window.initApp = () => NotesApplication.init()
NotesApplication.initWhenDomReady()
