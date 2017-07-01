const expect = require('chai').expect;
const proxyquire = require('proxyquire');
const sinon = require('sinon');

const dbQueryFixture = require('../../fixtures/db-query');

const sandbox = sinon.sandbox.create();

let stubs;
let instance;

const CharacterStub = function () {

	this.validate = sinon.stub();

};

beforeEach(() => {

	stubs = {
		dbQuery: sandbox.stub().resolves(dbQueryFixture),
		cypherTemplatesPlaytext: {
			getEditQuery: sandbox.stub().returns('getEditQuery response'),
			getUpdateQuery: sandbox.stub().returns('getUpdateQuery response'),
			getShowQuery: sandbox.stub().returns('getShowQuery response')
		},
		cypherTemplatesShared: {
			getValidateUpdateQuery: sandbox.stub().returns('getValidateUpdateQuery response'),
			getDeleteQuery: sandbox.stub().returns('getDeleteQuery response'),
			getListQuery: sandbox.stub().returns('getListQuery response')
		},
		prepareAsParams: sandbox.stub().returns('prepareAsParams response'),
		trimStrings: sandbox.stub(),
		validateString: sandbox.stub().returns([]),
		verifyErrorPresence: sandbox.stub().returns(false),
		Character: CharacterStub
	};

	instance = createInstance();

});

afterEach(() => {

	sandbox.restore();

});

const createSubject = (stubOverrides = {}) =>
	proxyquire('../../../dist/models/playtext', {
		'../database/db-query': stubOverrides.dbQuery || stubs.dbQuery,
		'../lib/cypher-templates/playtext': stubs.cypherTemplatesPlaytext,
		'../lib/cypher-templates/shared': stubs.cypherTemplatesShared,
		'../lib/prepare-as-params': stubs.prepareAsParams,
		'../lib/trim-strings': stubs.trimStrings,
		'../lib/validate-string': stubOverrides.validateString || stubs.validateString,
		'../lib/verify-error-presence': stubOverrides.verifyErrorPresence || stubs.verifyErrorPresence,
		'./character': stubs.Character
	});

const createInstance = (stubOverrides = {}) => {

	const subject = createSubject(stubOverrides);

	return new subject({ name: 'Hamlet', characters: [{ name: 'Hamlet' }] });

};

describe('Playtext model', () => {

	describe('validate method', () => {

		it('will trim strings before validating name', () => {

			instance.validate();
			expect(stubs.trimStrings.calledBefore(stubs.validateString)).to.be.true;
			expect(stubs.trimStrings.calledOnce).to.be.true;
			expect(stubs.trimStrings.calledWithExactly(instance)).to.be.true;
			expect(stubs.validateString.calledOnce).to.be.true;
			expect(stubs.validateString.calledWithExactly(instance.name, {})).to.be.true;

		});

		context('valid data', () => {

			it('will not add properties to errors property', () => {

				instance.validate();
				expect(instance.errors).not.to.have.property('name');
				expect(instance.errors).to.deep.eq({});

			});

		});

		context('invalid data', () => {

			it('will add properties that are arrays to errors property', () => {

				instance = createInstance({ validateString: sinon.stub().returns(['Name is too short']) });
				instance.validate();
				expect(instance.errors)
					.to.have.property('name')
					.that.is.an('array')
					.that.deep.eq(['Name is too short']);

			});

		});

	});

	describe('validateUpdateInDb method', () => {

		it('will validate update in database', done => {

			instance.validateUpdateInDb().then(() => {
				expect(stubs.cypherTemplatesShared.getValidateUpdateQuery.calledOnce).to.be.true;
				expect(stubs.cypherTemplatesShared.getValidateUpdateQuery.calledWithExactly(instance.model)).to.be.true;
				expect(stubs.dbQuery.calledOnce).to.be.true;
				expect(stubs.dbQuery.calledWithExactly(
					{ query: 'getValidateUpdateQuery response', params: instance }
				)).to.be.true;
				done();
			});

		});

		context('valid data (results returned that indicate name does not already exist)', () => {

			it('will not add properties to errors property', done => {

				instance = createInstance({ dbQuery: sinon.stub().resolves({ instanceCount: 0 }) });
				instance.validateUpdateInDb().then(() => {
					expect(instance.errors).not.to.have.property('name');
					expect(instance.errors).to.deep.eq({});
					done();
				});

			});

		});

		context('invalid data (results returned that indicate name already exists)', () => {

			it('will add properties that are arrays to errors property', done => {

				instance = createInstance({ dbQuery: sinon.stub().resolves({ instanceCount: 1 }) });
				instance.validateUpdateInDb().then(() => {
					expect(instance.errors)
						.to.have.property('name')
						.that.is.an('array')
						.that.deep.eq(['Name already exists']);
					done();
				});

			});

		});

	});

	describe('setErrorStatus method', () => {

		it('will call instance validate method + associated models\' validate methods then verifyErrorPresence', () => {

			sinon.spy(instance, 'validate');
			instance.setErrorStatus();
			sinon.assert.callOrder(
				instance.validate.withArgs({ required: true }),
				instance.characters[0].validate.withArgs(),
				stubs.verifyErrorPresence.withArgs(instance)
			);
			expect(instance.validate.calledOnce).to.be.true;
			expect(instance.characters[0].validate.calledOnce).to.be.true;
			expect(stubs.verifyErrorPresence.calledOnce).to.be.true;

		});

		context('valid data', () => {

			it('will set instance hasError property to false and return same value', () => {


				expect(instance.setErrorStatus()).to.be.false;
				expect(instance.hasError).to.be.false;

			});

		});

		context('invalid data', () => {

			it('will set instance hasError property to true and return same value', () => {

				instance = createInstance({ verifyErrorPresence: sinon.stub().returns(true) });
				expect(instance.setErrorStatus()).to.be.true;
				expect(instance.hasError).to.be.true;

			});

		});

	});

	describe('edit method', () => {

		it('will get edit data', done => {

			instance.edit().then(result => {
				expect(stubs.cypherTemplatesPlaytext.getEditQuery.calledOnce).to.be.true;
				expect(stubs.cypherTemplatesPlaytext.getEditQuery.calledWithExactly()).to.be.true;
				expect(stubs.dbQuery.calledOnce).to.be.true;
				expect(stubs.dbQuery.calledWithExactly(
					{ query: 'getEditQuery response', params: instance }
				)).to.be.true;
				expect(result).to.deep.eq(dbQueryFixture);
				done();
			});

		});

	});

	describe('update method', () => {

		context('valid data', () => {

			it('will update', done => {

				sinon.spy(instance, 'setErrorStatus');
				sinon.spy(instance, 'validateUpdateInDb');
				instance.update().then(result => {
					sinon.assert.callOrder(
						instance.setErrorStatus.withArgs(),
						instance.validateUpdateInDb.withArgs(),
						stubs.verifyErrorPresence.withArgs(instance),
						stubs.cypherTemplatesPlaytext.getUpdateQuery.withArgs(),
						stubs.prepareAsParams.withArgs(instance),
						stubs.dbQuery.withArgs({ query: 'getUpdateQuery response', params: 'prepareAsParams response' })
					);
					expect(instance.setErrorStatus.calledOnce).to.be.true;
					expect(instance.validateUpdateInDb.calledOnce).to.be.true;
					expect(stubs.verifyErrorPresence.calledTwice).to.be.true;
					expect(stubs.cypherTemplatesPlaytext.getUpdateQuery.calledOnce).to.be.true;
					expect(stubs.prepareAsParams.calledOnce).to.be.true;
					expect(stubs.dbQuery.calledTwice).to.be.true;
					expect(result).to.deep.eq(dbQueryFixture);
					done();
				});

			});

		});

		context('invalid data', () => {

			context('initial validation errors caused by submitted values', () => {

				it('will return instance without updating', done => {

					const verifyErrorPresenceStub = sinon.stub().returns(true);
					instance = createInstance({ verifyErrorPresence: verifyErrorPresenceStub });
					sinon.spy(instance, 'setErrorStatus');
					sinon.spy(instance, 'validateUpdateInDb');
					instance.update().then(result => {
						expect(instance.setErrorStatus.calledOnce).to.be.true;
						expect(verifyErrorPresenceStub.calledOnce).to.be.true;
						expect(instance.validateUpdateInDb.notCalled).to.be.true;
						expect(stubs.cypherTemplatesPlaytext.getUpdateQuery.notCalled).to.be.true;
						expect(stubs.prepareAsParams.notCalled).to.be.true;
						expect(stubs.dbQuery.notCalled).to.be.true;
						expect(result).to.deep.eq({ playtext: instance });
						done();
					});

				});

			});

			context('secondary validation errors caused by database checks', () => {

				it('will return instance without updating', done => {

					const verifyErrorPresenceStub = sinon.stub();
					verifyErrorPresenceStub.onFirstCall().returns(false).onSecondCall().returns(true);
					instance = createInstance({ verifyErrorPresence: verifyErrorPresenceStub });
					sinon.spy(instance, 'setErrorStatus');
					sinon.spy(instance, 'validateUpdateInDb');
					instance.update().then(result => {
						sinon.assert.callOrder(
							instance.setErrorStatus.withArgs(),
							instance.validateUpdateInDb.withArgs(),
							verifyErrorPresenceStub.withArgs(instance)
						);
						expect(instance.setErrorStatus.calledOnce).to.be.true;
						expect(instance.validateUpdateInDb.calledOnce).to.be.true;
						expect(verifyErrorPresenceStub.calledTwice).to.be.true;
						expect(stubs.cypherTemplatesPlaytext.getUpdateQuery.notCalled).to.be.true;
						expect(stubs.prepareAsParams.notCalled).to.be.true;
						expect(stubs.dbQuery.calledOnce).to.be.true;
						expect(result).to.deep.eq({ playtext: instance });
						done();
					});

				});

			});

		});

	});

	describe('delete method', () => {

		it('will delete', done => {

			instance.delete().then(result => {
				expect(stubs.cypherTemplatesShared.getDeleteQuery.calledOnce).to.be.true;
				expect(stubs.cypherTemplatesShared.getDeleteQuery.calledWithExactly(instance.model)).to.be.true;
				expect(stubs.dbQuery.calledOnce).to.be.true;
				expect(stubs.dbQuery.calledWithExactly(
					{ query: 'getDeleteQuery response', params: instance }
				)).to.be.true;
				expect(result).to.deep.eq(dbQueryFixture);
				done();
			});

		});

	});

	describe('show method', () => {

		it('will get show data', done => {

			instance.show().then(result => {
				expect(stubs.cypherTemplatesPlaytext.getShowQuery.calledOnce).to.be.true;
				expect(stubs.cypherTemplatesPlaytext.getShowQuery.calledWithExactly()).to.be.true;
				expect(stubs.dbQuery.calledOnce).to.be.true;
				expect(stubs.dbQuery.calledWithExactly(
					{ query: 'getShowQuery response', params: instance }
				)).to.be.true;
				expect(result).to.deep.eq(dbQueryFixture);
				done();
			});

		});

	});

	describe('list method', () => {

		it('will get list data', done => {

			const subject = createSubject();
			subject.list().then(result => {
				expect(stubs.cypherTemplatesShared.getListQuery.calledOnce).to.be.true;
				expect(stubs.cypherTemplatesShared.getListQuery.calledWithExactly('playtext')).to.be.true;
				expect(stubs.dbQuery.calledOnce).to.be.true;
				expect(stubs.dbQuery.calledWithExactly({ query: 'getListQuery response' })).to.be.true;
				expect(result).to.deep.eq(dbQueryFixture);
				done();
			});

		});

	});

});