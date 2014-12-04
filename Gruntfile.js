module.exports = function(grunt) {

	grunt.loadNpmTasks('grunt-mocha-test');

	grunt.initConfig({
		mochaTest: {
			test: {
				options: {
					reporter: 'spec',
                    timeout: 10000
				},
				src: ['test/**/*.js']
			}
		}
	});

	grunt.registerTask('test', [ 'mochaTest']);
};