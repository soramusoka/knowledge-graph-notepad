var _ = require('underscore');
var bodyParser = require('body-parser');
var logger = require('morgan');
var express = require('express');
var v = require('./topicValidator');
var repo = require('./topicApiController');
var mongo = require('mongodb');

var host = '127.0.0.1';
var port = mongo.Connection.DEFAULT_PORT;
var db = new mongo.Db('for-test', new mongo.Server(host, port, {}));

repo.setDb(db);
repo.setCollection('topic');

var app = express();

app.use(express.static(__dirname + '/public'));
app.use(logger('dev'));
app.use(bodyParser.json())

// Get all topics ---------------------------------------------------
app.get('/api/topic', function(req, resp){
	console.log('get /api/topic');

	var query = req.query;

	var count = query.count || 10;
	var offset = query.offset || 0;
	var category = query.category || '';

	var fields = getFields(query.fields);

	repo.getAll(count, offset, fields, category, function(error, array) {
		db.close();
		if(error)
			resp.send(error, 400);
		else
			resp.send(array, 200);
	});
});

// Get topic by ID ---------------------------------------------------
app.get('/api/topic/:id', function(req, resp){

	var id = createId(req.params.id);
	if(_.isEmpty(id)) {
		resp.send({ Message: 'Bad parameter: id' }, 400);
		return;
	}

	var fields = getFields(req.query.fields);

	repo.getById(id, fields, function(error, result) {
		db.close();

		if(error) {
			resp.send(error, 400);
			return;
		}

		if(_.isEmpty(result)){
			resp.send({ Message: 'Not found' }, 404);
			return;
		}

		resp.send(result, 200);
	});
});

// Add topic ---------------------------------------------------
app.post('/api/topic', function(req, resp) {
	var body = req.body;

	repo.addTopic(body, function(error, result) {
		db.close();
		if(error)
			resp.send(error, 400);
		else
			resp.send(result, 201);
	});
});

// Update topic ---------------------------------------------------
app.put('/api/topic/:id', function(req, resp) {
	
	var id = createId(req.params.id);
	if(_.isEmpty(id)) {
		resp.send({ Message: 'Bad parameter: id' }, 400);
		return;
	}

	var topic = req.body;
	repo.updateTopic(id, topic, function(error, updatedResults) {
		db.close();
		if(error) {
			resp.send(error, 400);
			return;
		}

		if(0 == updatedResults){
			resp.send({ Message: 'Not found' }, 404);
			return;
		}

		resp.send(updatedResults, 200);
	});		
});

// Delte topic ---------------------------------------------------
app.delete('/api/topic/:id', function(req, resp) {
	
	var id = createId(req.params.id);
	if(_.isEmpty(id)) {
		resp.send({ Message: 'Bad parameter: id' }, 400);
		return;
	}

	repo.deleteTopic(id, function(error, numberRemoved) {
		db.close();
		if(error) {
			resp.send(error, 400);
			return;
		}

		if(0 == numberRemoved){
			resp.send({ Message: 'Not found' }, 404);
			return;
		}

		resp.send(numberRemoved, 200);
	});		
});

/* 	Return titles
	@ids = array[string]
*/ 
app.post('/api/topic/titles', function(req, resp){
	var ids = req.body.ids;

	var idArray = _.compact(_.map(ids, function(id){
		try{
			return createId(id);
		}
		catch(e) {
			return {};
		}
	}));

	if(_.isEmpty(idArray)) {
		resp.send({ Message: 'Bad parameters: ids' }, 400);
		return;
	}

	repo.getTitles(idArray, { title: 1 }, function(error, result) {
		db.close();
		if(error){
			resp.send(error, 400);
			return;
		}

		if(_.isEmpty(result)){
			resp.send({ Message: 'Not found' }, 404);
			return;
		}

		resp.send(result, 200);
	});
});

/*	Search entry by title in collection
	@substring = string
	@fields = Object: example { title: 1 }
*/
app.get('/api/topic/search/:title', function(req, resp){
	console.log('get /api/topic/search/:title');

	var substring = req.params.title;
	if(!substring) {
		resp.send({ Message: 'Bad parameter: title' }, 400);
		return;
	}

	var fields = getFields(req.query.fields);

	repo.searchTitle(substring, fields, function(error, result) {
		db.close();

		if(error) {
			resp.send(error, 400);
			return;
		}

		if(_.isEmpty(result)){
			resp.send([], 200);
			return;
		}

		resp.send(result, 200);
	});
});

/*	Add connections to entries
	@firstid 	= string
	@secondid 	= string
*/
app.post('/api/topic/:firstid/connection/:secondid', function(req, resp){
	var firstid = createId(req.params.firstid);
	var secondid = createId(req.params.secondid);

	if(_.isEmpty(firstid) || _.isEmpty(secondid)) {
		resp.send({ Message: 'Bad parameter: id' }, 400);
		return;
	}

	repo.addConnection(firstid, secondid, function(error, type) {
		db.close();
		if(error) {
			if(type == 'schema')
				resp.send(error, 400);
			else
				resp.send(error, 500);
			return;
		}

		resp.send(1, 200);
	});
});

/*	Delete connections from entries
	@firstid 	= string
	@secondid 	= string
*/
app.delete('/api/topic/:firstid/connection/:secondid', function(req, resp){
	var firstid = createId(req.params.firstid);
	var secondid = createId(req.params.secondid);

	if(_.isEmpty(firstid) || _.isEmpty(secondid)) {
		resp.send({ Message: 'Bad parameter: id' }, 400);
		return;
	}

	repo.deleteConnection(firstid, secondid, function(error) {
		db.close();
		if(error) {
			resp.send(error, 404);
			return;
		}

		resp.send(1, 200);
	});
});

/*	Add link to entry
	@id 	= string
	@link 	= Link class { id: int, type: string, url: string, title: string }
*/
app.post('/api/topic/:id/link', function(req, resp){
	var id = createId(req.params.id);
	if(_.isEmpty(id)) {
		resp.send({ Message: 'Bad parameter: id' }, 400);
		return;
	}

	var link = req.body.link;
	if(_.isEmpty(link)) {
		resp.send({ Message: 'Bad parameter: link' }, 400);
		return;
	}

	repo.addLink(id, link, function(error, type) {
		db.close();
		if(error) {
			if(type == "schema")
				resp.send(error, 400);
			else
				resp.send(error, 500);
			return;
		}

		resp.send(1, 200);
	});
});

/*	Delete link from entry
	@id 	= string
	@idLink = int
*/
app.delete('/api/topic/:id/link/:idlink', function(req, resp){
	var id = createId(req.params.id);
	if(_.isEmpty(id)) {
		resp.send({ Message: 'Bad parameter: id' }, 400);
		return;
	}

	var idlink = 0;
	try {
		idlink = parseInt(req.params.idlink);
	}
	catch(e){}
	
	if(!idlink) {
		resp.send({ Message: 'Bad parameter: idlink' }, 400);
		return;
	}

	repo.deleteLink(id, idlink, function(error, r) {
		db.close();
		if(error) {
			resp.send(error, 500);
			return;
		}
		console.log(r);

		resp.send(1, 200);
	});
});

// ---------------------------------------------------
app.get('*', function(req, resp){
	var body = 'Default request!';
	resp.setHeader('Content-Type', 'text/html');
	resp.setHeader('Content-Length', body.length);
	resp.send(body);
});
app.listen(3000);
console.log('Server is running...');

//var id = createId('539d74cfeebbdcc40905b4e0');

/*var id = createId('539d74cfeebbdcc40905b4e0');
var secondId = createId('539d902a5d2de1182034dd39');
var thirdId = createId('539d902a5d2de1182034dd37');

{
"title": "search title",
"value": "1",
"category": "1",
"status": "1",
"links": [],
"connections": []
}

repo.getAll(5, 0, {}, '', function(err, data) {

	_.each(data, function(elm){
		console.log(elm);
	});
	db.close();
});*/

/*repo.getById(id, {}, function(error, topic){
	console.log(topic);

	db.close();
});*/

/*repo.addTopic(topic, function(error){
	console.log(error);
	db.close();
});*/

/*repo.updateTopic(id, topic, function(error, result) {
	console.log(error, result);
	db.close();
});*/

/*repo.deleteTopic(deleteId, function(error, result){
	console.log(error, result);
	db.close();
});*/

/*repo.getTitles([id, createId('539d902a5d2de1182034dd37')], { title: 1 }, function(error, result){
	console.log(error, result);
	db.close();
});*/

/*repo.searchTitle('sea', { title: 1 }, function(error, result) {
	console.log(error, result);
	db.close();
});*/

/*repo.addConnection(id, thirdId, function(error) {
	console.log(error);
	db.close();
});*/

/*repo.deleteConnection(id, thirdId, function(error) {
	console.log(error);
	db.close();
});*/

//var link = { id: 1, type: 'в ожидании', title: 'вики', url: 'http://google.com' };
/*repo.addLink(id, link, function(error) {
	console.log(error);
	db.close();
});*/

/*repo.deleteLink(id, 1, function(error) {
	console.log(error);
	db.close();
});*/

var getDate = function(){
	return new Date().toLocaleString();
};

var createId = function(stringKey){
	var id = {};
	try {
		id = new mongo.ObjectID(stringKey);	
	}
	catch (e) {
	}
	return id;
};

var getFields = function(str) {
	var tempFields = (str || '').split('.');
	var fields = {};
	_.each(tempFields, function(e) {
		fields[e] = 1;
	});
	return fields;
};