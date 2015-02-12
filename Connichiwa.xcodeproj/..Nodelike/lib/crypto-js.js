;(function (root, factory, undef) {
	if (typeof exports === "object") {
		// CommonJS
		module.exports = exports = factory(require("cjs-core"), require("cjs-x64-core"), require("cjs-lib-typedarrays"), require("cjs-enc-utf16"), require("cjs-enc-base64"), require("cjs-md5"), require("cjs-sha1"), require("cjs-sha256"), require("cjs-sha224"), require("cjs-sha512"), require("cjs-sha384"), require("cjs-sha3"), require("cjs-ripemd160"), require("cjs-hmac"), require("cjs-pbkdf2"), require("cjs-evpkdf"), require("cjs-cipher-core"), require("cjs-mode-cfb"), require("cjs-mode-ctr"), require("cjs-mode-ctr-gladman"), require("cjs-mode-ofb"), require("cjs-mode-ecb"), require("cjs-pad-ansix923"), require("cjs-pad-iso10126"), require("cjs-pad-iso97971"), require("cjs-pad-zeropadding"), require("cjs-pad-nopadding"), require("cjs-format-hex"), require("cjs-aes"), require("cjs-tripledes"), require("cjs-rc4"), require("cjs-rabbit"), require("cjs-rabbit-legacy"));
	}
	else if (typeof define === "function" && define.amd) {
		// AMD
		define(["cjs-core", "cjs-x64-core", "cjs-lib-typedarrays", "cjs-enc-utf16", "cjs-enc-base64", "cjs-md5", "cjs-sha1", "cjs-sha256", "cjs-sha224", "cjs-sha512", "cjs-sha384", "cjs-sha3", "cjs-ripemd160", "cjs-hmac", "cjs-pbkdf2", "cjs-evpkdf", "cjs-cipher-core", "cjs-mode-cfb", "cjs-mode-ctr", "cjs-mode-ctr-gladman", "cjs-mode-ofb", "cjs-mode-ecb", "cjs-pad-ansix923", "cjs-pad-iso10126", "cjs-pad-iso97971", "cjs-pad-zeropadding", "cjs-pad-nopadding", "cjs-format-hex", "cjs-aes", "cjs-tripledes", "cjs-rc4", "cjs-rabbit", "cjs-rabbit-legacy"], factory);
	}
	else {
		// Global (browser)
		factory(root.CryptoJS);
	}
}(this, function (CryptoJS) {

	return CryptoJS;

}));