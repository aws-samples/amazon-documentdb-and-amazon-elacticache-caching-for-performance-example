# Caching for performance with Amazon DocumentDB and Amazon ElastiCache

# Solution overview
This demo showcases how to integrate [Amazon DocumentDB (with MongoDB compatibility)](https://aws.amazon.com/documentdb/) and [Amazon ElastiCache](http://aws.amazon.com/elasticache) to achieve microsecond response times and reduce your overall cost. The following diagram shows the architecture of the demo app.

![alt text](img/architecture-diagram.png)

The demo application allows users to find their favorite song. They submit the song title using a REST API client to the application engine. The application engine processes the API request by retrieving the document containing the singer’s name and lyrics of the requested song from the ElastiCache layer. If there has been a prior request for that song already, the read is served by ElastiCache to speed up the response time. If not, the application engine queries Amazon DocumentDB and returns the requested document to the client as a JSON document.

In this demo, we use Amazon ElastiCache for Redis as the caching layer and a REST API client tool [Postman](https://www.getpostman.com/docs/) for testing our REST API requests.

# Create an Amazon DocumentDB Cluster 

We will use the AWS CLI to create our DocumentDB cluster instance. For more information about creating a cluster, see [Getting Started](https://docs.aws.amazon.com/documentdb/latest/developerguide/getting-started.html):

	aws docdb create-db-cluster --db-cluster-identifier docdb --engine docdb --master-username docdbadmin --master-user-password <########>

# Create a Cache Cluster for Redis (Cluster Mode Disabled) (AWS CLI) 

We will use the CLI command below to create a Redis (cluster mode disabled) cache cluster with no replicas. 

	aws elasticache create-cache-cluster --cache-cluster-id myredis --cache-node-type cache.r4.large --engine redis --engine-version 5.0.6 --num-cache-nodes 2 --cache-parameter-group default.redis5.0

# Create an EC2 instance

We will host the song application on an Amazon EC2 instance.

1. [Create an EC2 Linux instance](https://docs.aws.amazon.com/cli/latest/reference/opsworks/create-instance.html). Ensure that it has a public IP address.
2. [Launch the instance with a key pair](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/AccessingInstances.html).

Download your key pair file (.pem), which stores the private keys associated with your newly created instance, and connect to it using the following command:

	ssh -i ~/<path_to_instance_keypair_file>/<keypair_file>.pem ec2-user@<your_ec2_instance_public_dns_or_IP>

For example, if you named your key pair file my-key-pair.pem and your EC2 instance DNS is ec2-198-51-100-1.compute-1.amazonaws.com, the command would be:

	ssh -i /<path>/my-key-pair.pem ec2-user@ec2-198-51-100-1.compute-1.amazonaws.com

# Connect to the clusters

To connect to your Amazon DocumentDB and ElastiCache clusters, update the security groups for the two clusters to allow inbound traffic for TCP ports 27017 and 6379, respectively.

Also enable inbound connections on the security group for the EC2 instance on TCP port 8082, which the demo application is listening on as shown in the following screenshot.

# Install the MongoDB shell

Next, install the MongoDB shell on the EC2 instance. Instructions for installing the MongoDB shell can be found on [YouTube](https://www.youtube.com/watch?v=qk98rR08szU) or in the [Getting Started guide](https://docs.aws.amazon.com/documentdb/latest/developerguide/getting-started.connect.html).
Verify the connection

Verify that you’re able to connect to the Amazon DocumentDB cluster from the EC2 instance, using the following command:

	[ec2-user@ip-xx-xx-xx-xx ~]$ mongo --ssl --host docdb-2019-06-16-22-03-10.cluster-c9di9qmu8xqw.us-east-1.docdb.amazonaws.com:27017 --sslCAFile rds-combined-ca-bundle.pem --username docdbadmin --password <###########>
	MongoDB shell version v3.6.13
	connecting to: mongodb://docdb-2019-06-16-22-03-10.cluster-c9di9qmu8xqw.us-east-1.docdb.amazonaws.com:27017/?gssapiServiceName=mongodb
	Implicit session: session { "id" : UUID("1fe7a152-8340-4d8e-b329-09c722b53b10") }
	MongoDB server version: 3.6.0
	rs0:PRIMARY>

Next, verify that you’re able to connect to the Amazon ElastiCache cluster. To do that, install the Redis command line interface (CLI) using the following steps on the same EC2 instance hosting the song application:

	sudo yum install gcc
	wget http://download.redis.io/redis-stable.tar.gz 
	tar xvzf redis-stable.tar.gz
	cd redis-stable
	make

To verify, connect to the ElastiCache for Redis cluster by running the following command:

	src/redis-cli -h myredis.obpmqw.ng.0001.use1.cache.amazonaws.com -p 6379

You should get the following ElastiCache prompt, confirming that you’re connected to the cluster.

	myredis.obpmqw.ng.0001.use1.cache.amazonaws.com:6379>

Now, run the following keys * command to see what is currently in your cache.

	myredis.obpmqw.ng.0001.use1.cache.amazonaws.com:6379> keys *
	(empty list or set)

The output confirms that the cache is empty.

# Build the app engine

Now that you can successfully connect to both the Amazon DocumentDB database and ElastiCache, you can start building the Node.js app engine on a separate EC2 instance.

Use the same Node.js application running on the EC2 instance to populate the Amazon DocumentDB cluster with data containing singer, title, and text lyrics details.

First, ensure that Node.js is installed on the EC2 instance.

After Node.js is installed on the EC2 instance, check that Node Package Manager (npm) is installed by running the following commands:

	       __|  __|_  )
	       _|  (     /   Amazon Linux 2 AMI
	      ___|\___|___|
	
	https://aws.amazon.com/amazon-linux-2/
	16 package(s) needed for security, out of 23 available
	Run "sudo yum update" to apply all updates.
	[ec2-user@ip-xx-xx-xx-xx ~]$ npm --version
	6.9.0
	[ec2-user@ip-xx-xx-xx-xx ~]$ which node
	~/.nvm/versions/node/v10.16.0/bin/node
	[ec2-user@ip-172-31-34-254 ~]$ 

## Create an application directory

Next, create a directory for the application and change to that directory using the commands below:

	mkdir cdstore
	cd cdstore

The following command generates the package.json file:

	npm init

You may select the default index.js value, but for main, enter cdstore.js instead of index.js.
Install dependencies

Next, install all the dependencies needed for the application to work. These include MongoDB driver that allows the application to connect to Amazon DocumentDB, a Node.js web application framework, a Node.js Redis client, and a body-parser that is Node.js body parsing middleware. Install them by running the following commands:

	npm install express --save
	npm install mongodb --save
	npm install redis –save
	npm install body-parser –save

The contents of the package.json file are as follows:

	{
	  "name": "cdstore",
	  "version": "1.0.0",
	  "description": "songs search engine app to showcase Amazon DocumentDB and Elasticache integration",
	  "main": "cdstore.js",
	  "scripts": {
	    "test": "echo \"Error: no test specified\" && exit 1"
	  },
	  "author": "GL",
	  "license": "ISC",
	  "dependencies": {
	    "body-parser": "^1.19.0",
	    "express": "^4.17.1",
	    "mongodb": "^3.2.7",
	    "mongoose": "^5.6.0",
	    "redis": "^2.8.0"
	  }
	}

## Create the functions

Create two functions:

A SaveSong () function used for sending a /POST request to insert data into the Amazon DocumentDB instance. You could also write a script to insert data in bulk using the command db.<collection_name>.insert().

SearchSongByTitle() is used by the /GET method to perform the actual search.

Store the two functions in a file called cache.js. Create that file:

	touch cache.js
	
Use your favorite editor (vim, vi, etc.) and copy the code from the file cache.js and paste into your file and save.

## Create the endpoint

Now, create the endpoint cdstore.js as follows:

	touch cdstore.js

Copy the code from cdstore.js and paste into yours using your favorite editor.

## Start the application

Next, start the application, which, in this example, is set to run on port 8082 on the EC2 instance. To do that, use the following command:

	node cdstore.js

If everything is running correctly, you should see the following message on the console:

	Listening on port 8082

# Testing the application
Please following the instructions in this [blog post](https://aws.amazon.com/blogs/database/caching-for-performance-with-amazon-documentdb-and-amazon-elasticache/) for inserting test data into your Amazon DocumentDB cluster instance and making GET and POST requests to demonstrate the performance imporvement related to the use of Amazon ElastiCache.

## License

This library is licensed under the MIT-0 License. See the LICENSE file.

