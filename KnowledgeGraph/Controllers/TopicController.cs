﻿using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web.Http;
using KnowledgeGraph.Models;
using Raven.Client;
using Raven.Client.Document;

namespace KnowledgeGraph.Controllers
{
	public class TopicController : ApiController
	{
		private string dbHost;
		private string dbBase;

		public TopicController()
		{
			dbHost = ConfigurationSettings.AppSettings["RavenDbHost"];
			dbBase = ConfigurationSettings.AppSettings["RavenDbBase"];
		}

		// GET api/topic
		[ActionName("DefaultAction")]
		public HttpResponseMessage Get(int count = 25, int offset = 0)
		{
			using (var _store = new DocumentStore { Url = dbHost, DefaultDatabase = dbBase }.Initialize())
			{
				using (var _session = _store.OpenSession())
				{
					var _result = _session.Query<Topic>()
											.OrderByDescending(x => x.Created)
											.Skip(offset)
											.Take(count)
											.ToList();

					return Request.CreateResponse(HttpStatusCode.OK, _result);
				}
			}
		}

		// GET api/topic/5
		[ActionName("DefaultAction")]
		public HttpResponseMessage Get(int id)
		{
			if (id <= 0)
				return Request.CreateErrorResponse(HttpStatusCode.BadRequest, "Id should be more than 0");

			using (var _store = new DocumentStore { Url = dbHost, DefaultDatabase = dbBase }.Initialize())
			{
				using (var _session = _store.OpenSession())
				{
					var _result = _session.Load<Topic>("topics/" + id);

					if (_result != null)
						return Request.CreateResponse(HttpStatusCode.OK, _result);

					return Request.CreateErrorResponse(HttpStatusCode.NotFound, "This ID doesn't exists.");
				}
			}
		}

		// POST api/topic
		[ActionName("DefaultAction")]
		public HttpResponseMessage Post(Topic newTopic)
		{
			if (CheckModel(newTopic))
			{
				using (var _store = new DocumentStore { Url = dbHost, DefaultDatabase = dbBase }.Initialize())
				{
					using (var _session = _store.OpenSession())
					{
						newTopic.Created = DateTime.UtcNow;
						newTopic.Modified = DateTime.UtcNow;

						_session.Store(newTopic);
						_session.SaveChanges();

						return Request.CreateResponse(HttpStatusCode.Created, newTopic.Id);
					}
				}
			}
			return Request.CreateErrorResponse(HttpStatusCode.BadRequest, "Not correct topic structure");
		}

		// PUT api/topic/5
		[ActionName("DefaultAction")]
		public HttpResponseMessage Put(int id, Topic oldTopic)
		{
			if (id <= 0)
				return Request.CreateErrorResponse(HttpStatusCode.BadRequest, "Id should be more than 0");

			if (CheckModel(oldTopic))
			{
				using (var _store = new DocumentStore { Url = dbHost, DefaultDatabase = dbBase }.Initialize())
				{
					using (var _session = _store.OpenSession())
					{
						var _result = _session.Load<Topic>("topics/" + id);

						_result.Modified = DateTime.UtcNow;

						_result.Title = oldTopic.Title;
						_result.Value = oldTopic.Value;
						_result.Category = oldTopic.Category;
						_result.Status = oldTopic.Status;

						_result.Connections = oldTopic.Connections;
						_result.Links = oldTopic.Links;

						_session.SaveChanges();

						return Request.CreateResponse(HttpStatusCode.OK, true);
					}
				}
			}
			return Request.CreateErrorResponse(HttpStatusCode.BadRequest, "Not correct topic structure");
		}

		// DELETE api/topic/5
		[ActionName("DefaultAction")]
		public HttpResponseMessage Delete(int id)
		{
			if (id <= 0)
				return Request.CreateErrorResponse(HttpStatusCode.BadRequest, "Id should be more than 0");

			using (var _store = new DocumentStore { Url = dbHost, DefaultDatabase = dbBase }.Initialize())
			{
				using (var _session = _store.OpenSession())
				{
					var _result = _session.Load<Topic>("topics/" + id);

					if (_result == null)
						return Request.CreateErrorResponse(HttpStatusCode.NotFound, "This ID doesn't exists.");

					if (_result.Connections != null)
					{
						foreach (var _link in _result.Connections)
						{
							_session.Load<Topic>("topics/" + _link)
									.IfNotNull(x => x.Connections.Remove(id));
						}
					}

					_session.Delete(_result);
					_session.SaveChanges();

					return Request.CreateResponse(HttpStatusCode.OK);

				}
			}
		}

		[HttpPost]
		public HttpResponseMessage GetPostsTitles(int id, int[] arrayId)
		{
			if (id <= 0)
				return Request.CreateErrorResponse(HttpStatusCode.BadRequest, "ID should be more than 0");

			using (var _store = new DocumentStore { Url = dbHost, DefaultDatabase = dbBase }.Initialize())
			{
				using (var _session = _store.OpenSession())
				{
					var _result = new List<TitleResponse>();
					foreach (var _topicId in arrayId)
					{
						var _topic = _session.Load<Topic>("topics/" + _topicId);
						_result.Add(new TitleResponse { Id = _topic.Id, Title = _topic.Title });
					}

					return Request.CreateResponse(HttpStatusCode.OK, _result);
				}
			}
		}

		[HttpPost]
		public HttpResponseMessage BreakConnections(int id, int[] conId)
		{
			if (id <= 0 || conId[0] <= 0)
				return Request.CreateErrorResponse(HttpStatusCode.BadRequest, "ID and ConID should be more than 0");

			using (var _store = new DocumentStore { Url = dbHost, DefaultDatabase = dbBase }.Initialize())
			{
				using (var _session = _store.OpenSession())
				{
					var _firstTopic = _session.Load<Topic>("topics/" + id);
					_firstTopic.IfNotNull(x => x.Connections.Remove(conId[0]));

					var _secondTopic = _session.Load<Topic>("topics/" + conId[0]);
					_secondTopic.IfNotNull(x => x.Connections.Remove(id));

					_session.SaveChanges();

					return Request.CreateResponse(HttpStatusCode.OK, true);
				}
			}
		}

		[HttpPost]
		public HttpResponseMessage DeleteLink(int id, Link link)
		{
			if (id <= 0 || link == null)
				return Request.CreateErrorResponse(HttpStatusCode.BadRequest, "ID and Links should be more than 0");

			using (var _store = new DocumentStore { Url = dbHost, DefaultDatabase = dbBase }.Initialize())
			{
				using (var _session = _store.OpenSession())
				{
					var _firstTopic = _session.Load<Topic>("topics/" + id);
					_firstTopic.IfNotNull(x =>
					{
						var _fLink = x.Links.First(l => l.Url == link.Url && l.Title == link.Title);
						x.Links.Remove(_fLink);
					});

					_session.SaveChanges();

					return Request.CreateResponse(HttpStatusCode.OK, true);
				}
			}
		}

		[HttpPost]
		public HttpResponseMessage AddLink(int id, Link link)
		{
			if (id <= 0 || link == null)
				return Request.CreateErrorResponse(HttpStatusCode.BadRequest, "ID and Links should be more than 0");

			using (var _store = new DocumentStore { Url = dbHost, DefaultDatabase = dbBase }.Initialize())
			{
				using (var _session = _store.OpenSession())
				{
					var _firstTopic = _session.Load<Topic>("topics/" + id);
					_firstTopic.IfNotNull(x =>
					{
						if (x.Links == null)
							x.Links = new List<Link>();

						x.Links.Add(link);
					});

					_session.SaveChanges();

					return Request.CreateResponse(HttpStatusCode.OK, true);
				}
			}
		}

		[HttpPost]
		public HttpResponseMessage Category(int id, dynamic data)
		{
			string _category = data.category;
			int _count = data.count;
			int _offset = data.offset;

			using (var _store = new DocumentStore { Url = this.dbHost, DefaultDatabase = this.dbBase }.Initialize())
			{
				using (var _session = _store.OpenSession())
				{
					var _result = _session.Query<Topic>()
									.Where(x => x.Category == _category)
									.OrderByDescending(x => x.Created)
									.Skip(_offset)
									.Take(_count)
									.Select(x => new Topic
									{
										Id = x.Id,
										Title = x.Title,
										Category = x.Category,
										Status = x.Status,
										Created = x.Created,
										Connections = x.Connections
									});

					return Request.CreateResponse(HttpStatusCode.OK, _result.ToList());
				}
			}
		}

		private bool CheckModel(Topic topic)
		{
			return topic != null && !String.IsNullOrEmpty(topic.Title) && !String.IsNullOrEmpty(topic.Value);
		}
	}

	public class TitleResponse
	{
		public int Id;
		public string Title;
	}

	public static class Ext
	{
		public static void IfNotNull<T>(this T obj, Action<T> action) where T : class
		{
			if (obj != null)
				action(obj);
		}
	}
}
