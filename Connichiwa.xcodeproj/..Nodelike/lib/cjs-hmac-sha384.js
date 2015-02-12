;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("cjs-core"), require("cjs-x64-core"), require("cjs-sha512"), require("cjs-sha384"), require("cjs-hmac"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["cjs-core", "cjs-x64-core", "cjs-sha512", "cjs-sha384", "cjs-hmac"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	return CryptoJS.HmacSHA384;

}));