const expect = require('chai').expect;
const sinon = require('sinon');

const Production = require('../../../../server/models/production');

const stubs = {
	Production: sinon.createStubInstance(Production)
};

const subject = require('../../../../server/lib/handlebars-helpers/model-lower-case');

describe('Model Lower Case handlebars helper', () => {

	context('model instance', () => {

		it('will return model name of instance in lower case', () => {
			expect(subject(stubs.Production)).to.eq('production');
		});

	});

	context('array of model instances', () => {

		it('will return pluralised model name of first instance in array in lower case', () => {
			expect(subject([stubs.Production])).to.eq('productions');
		});

	});

});