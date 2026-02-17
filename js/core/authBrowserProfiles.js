function readUserAgent() {
    if (typeof navigator === "undefined") return ""
    return String(navigator.userAgent || "")
}

function readUserAgentDataBrands() {
    if (typeof navigator === "undefined") return ""
    const brands = navigator.userAgentData?.brands
    if (!Array.isArray(brands)) return ""
    return brands.map(brand => String(brand.brand || "")).join(" ")
}

function createMatchSource() {
    const userAgent = readUserAgent()
    const brands = readUserAgentDataBrands()
    return `${userAgent} ${brands}`.toLowerCase()
}

function matches(source, expression) {
    return expression.test(source)
}

export function detectBrowserProfile() {
    const source = createMatchSource()
    const isAndroid = matches(source, /android/)
    const isIphone = matches(source, /iphone/)
    const isIpad = matches(source, /ipad/)
    const isIpod = matches(source, /ipod/)
    const isIos = isIphone || isIpad || isIpod
    const isMobile = isAndroid || isIos || matches(source, /mobile/)
    const isFirefox = matches(source, /firefox|fxios/)
    const isEdge = matches(source, /edg|edgios/)
    const isOpera = matches(source, /opr|opera/)
    const isOperaGx = matches(source, /opera gx|operagx/)
    const isYandex = matches(source, /yabrowser|yowser/)
    const isSamsung = matches(source, /samsungbrowser/)
    const isDuckDuckGo = matches(source, /duckduckgo/)
    const isSoul = matches(source, /soul/)
    const isChromeFamily = matches(source, /chrome|chromium|crios/)
    const isBrave = typeof navigator !== "undefined" && !!navigator.brave
    const isSafari = matches(source, /safari/) && !isChromeFamily && !isFirefox && !isEdge && !isOpera && !isYandex && !isSamsung
    const engine = isFirefox ? "gecko" : (isSafari ? "webkit" : "chromium")

    return {
        engine,
        isMobile,
        isIos,
        isFirefox,
        isSafari,
        isBrave,
        isEdge,
        isOpera,
        isOperaGx,
        isYandex,
        isSamsung,
        isDuckDuckGo,
        isSoul,
        isChromeFamily
    }
}
