Connichiwa
==========

A framework for local multi-device web applications. In development.

Installation
==========
For installation instructions visit the [Wiki](http://wiki.connichiwa.info)

Used Projects
==========
Connichiwa is based on a huge number of open source projects that are also included in this repository and that you therefore download when you clone this repo. Therefore, every one of those projects should be properly listed here. A big thanks to all those people that work in their free time to release open source code that makes something like Connichiwa possible. It's simply amazing!

* The underlying webserver of Connichiwa is a fork of [Nodelike](https://github.com/node-app/Nodelike), which in turn is a cocoa version of [Node.js](http://nodejs.org).

Furthermore, the following Node.js modules have been used either as provided or with slight changes to make them compatible with Nodelike:
* [crypto-js](https://github.com/evanvosberg/crypto-js) (as part of the Nodelike fork), which is based on the [CryptoJS Javascript Library](https://code.google.com/p/crypto-js/)
* [buffer-crc32](https://github.com/brianloveswords/buffer-crc32)
* [bytes](https://github.com/visionmedia/bytes.js)
* [connect](https://github.com/senchalabs/connect)
* [cookie-signature](https://github.com/visionmedia/node-cookie-signature)
* [debug](https://github.com/visionmedia/debug)
* [fresh](https://github.com/visionmedia/node-fresh)
* [parseurl](https://github.com/expressjs/parseurl)
* [range-parser](https://github.com/visionmedia/node-range-parser)
* [send](https://github.com/visionmedia/send)
* [serve-static](https://github.com/expressjs/serve-static)
* [cookie](https://github.com/defunctzombie/node-cookie)
* [mime](https://github.com/broofa/node-mime)
* [accepts](https://github.com/expressjs/accepts)
* [escape-html](https://github.com/component/escape-html)
* [express](https://github.com/visionmedia/express)
* [methods](https://github.com/visionmedia/node-methods)
* [morgan](https://github.com/expressjs/morgan)
* [negotiator](https://github.com/federomero/negotiator)
* [path-to-regexp](https://github.com/component/path-to-regexp)
* [qs](https://github.com/visionmedia/node-querystring)
* [type-is](https://github.com/expressjs/type-is)
* [utils-merge](https://github.com/jaredhanson/utils-merge)
* [options](https://github.com/einaros/options.js)
* [ws](https://github.com/einaros/ws)

Also, I want to thank the people behind [VVDocumenter-Xcode](https://github.com/onevcat/VVDocumenter-Xcode) and [appledoc](https://github.com/tomaz/appledoc) that helped make that nice documentation possible that you find in the `ConnichiwaDocs/native` folder.

Furthermore, thanks to [jsdoc](https://github.com/jsdoc3/jsdoc) for creating the documentation seen in `ConnichiwaDocs/weblib` and to the people behind [jshint](http://www.jshint.com) and [jscs](https://www.npmjs.org/package/jscs) for making it easily possible to check my JS code for flaws. Also, thanks to the people who created atom.io packages for [Linter](https://github.com/AtomLinter/Linter), [Linter Jscs](https://github.com/AtomLinter/linter-jscs) and [Linter Jshint](https://github.com/AtomLinter/linter-jshint) :-)

For minification of the web library, I used [minifyjs](https://github.com/clarkf/minifyjs).
