const path = require("path")

const outputFolderName = "public"
const outputPath = path.resolve(__dirname, outputFolderName)
const libraryName = "divinaPlayer"
const outputFileName = `${libraryName}.js`

module.exports = {
	module: {
		rules: [
			{
				test: /\.js$/,
				exclude: /node_modules/,
				use: {
					loader: "babel-loader",
				},
			},
			{
				test: /\.js$/,
				loader: "string-replace-loader",
				options: {
					search: "eslint-enable",
					replace: "eslint-disable",
					flags: "g",
				},
			},
		],
	},
	output: {
		path: outputPath,
		filename: outputFileName,
		library: libraryName,
		libraryTarget: "window",
		libraryExport: "default",
	},
	optimization: {
		minimize: true,
	},
	devtool: "source-map",
}