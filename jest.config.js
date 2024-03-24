module.exports = {
	setupFiles: ['./jest.setup.js'],
	transform: {
		'^.+\\.(css|less)?$':
			'<rootDir>/node_modules/jest-css-modules-transform',
		'^.+\\.js?$': 'babel-jest',
		'^.+\\.ts[x]?$': 'ts-jest'
	},
	testPathIgnorePatterns: ['<rootDir>/lib', '<rootDir>/typings'],
	moduleFileExtensions: ['tsx', 'ts', 'less', 'js', 'json', 'jsx'],
	moduleNameMapper: {
		'^utils(.*)$': '<rootDir>/src/utils$1',
		'^three-examples(.*)$': '<rootDir>/node_modules/three/examples$1',
		'\\.(jpg|jpeg|png|gif)$': '<rootDir>/__mocks__/file.js'
	}
}
