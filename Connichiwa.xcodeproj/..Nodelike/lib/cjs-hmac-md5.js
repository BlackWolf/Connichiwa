;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("cjs-core"), require("cjs-md5"), require("cjs-hmac"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["cjs-core", "cjs-md5", "cjs-hmac"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	return CryptoJS.HmacMD5;

}));