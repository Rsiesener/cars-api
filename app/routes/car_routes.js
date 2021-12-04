// Express docs: http://expressjs.com/en/api.html
const express = require('express')
// Passport docs: http://www.passportjs.org/docs/
const passport = require('passport')

// pull in Mongoose model for Cars
const Car = require('../models/car-schema')

// this is a collection of methods that help us detect situations when we need
// to throw a custom error
const customErrors = require('../../lib/custom_errors')

// we'll use this function to send 404 when non-existant document is requested
const handle404 = customErrors.handle404
// we'll use this function to send 401 when a user tries to modify a resource
// that's owned by someone else
const requireOwnership = customErrors.requireOwnership

// this is middleware that will remove blank fields from `req.body`, e.g.
// { Car: { title: '', text: 'foo' } } -> { Car: { text: 'foo' } }
const removeBlanks = require('../../lib/remove_blank_fields')
// passing this as a second argument to `router.<verb>` will make it
// so that a token MUST be passed for that route to be available
// it will also set `req.user`
const requireToken = passport.authenticate('bearer', { session: false })

// instantiate a router (mini app that only handles routes)
const router = express.Router()

// INDEX
// GET /Cars
router.get('/cars', requireToken, (req, res, next) => {
  Car.find()
    // respond with status 200 and JSON of the Cars
    .then(cars => res.status(200).json({ cars: cars }))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// SHOW
// GET /Cars/5a7db6c74d55bc51bdf39793
router.get('/cars/:id', requireToken, (req, res, next) => {
  // req.params.id will be set based on the `:id` in the route
  Car.findById(req.params.id)
    .then(handle404)
    // if `findById` is succesful, respond with 200 and "Car" JSON
    .then(car => res.status(200).json({ car: car }))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// CREATE
// POST /Cars
router.post('/cars', requireToken, (req, res, next) => {
  // set owner of new Car to be current user
  req.body.car.owner = req.user.id
  Car.create(req.body.car)
    // respond to succesful `create` with status 201 and JSON of new "Car"
    .then(car => {
      res.status(201).json({ car })
    })
    // if an error occurs, pass it off to our error handler
    // the error handler needs the error message and the `res` object so that it
    // can send an error message back to the client
    .catch(next)
})

// UPDATE
// PATCH /Cars/5a7db6c74d55bc51bdf39793
router.patch('/cars/:id', requireToken, removeBlanks, (req, res, next) => {
  // if the client attempts to change the `owner` property by including a new
  // owner, prevent that by deleting that key/value pair
  delete req.body.car.owner

  Car.findById(req.params.id)
    .then(handle404)
    // ensure the signed in user (req.user.id) is the same as the Car's owner (Car.owner)
    .then(car => requireOwnership(req, car))
    // updating Car object with CarData
    .then(car => car.updateOne(req.body.car))
    // if that succeeded, return 204 and no JSON
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(next)
})

// DESTROY
// DELETE /Cars/5a7db6c74d55bc51bdf39793
router.delete('/cars/:id', requireToken, (req, res, next) => {
  Car.findById(req.params.id)
    .then(handle404)
    // ensure the signed in user (req.user.id) is the same as the Car's owner (Car.owner)
    .then(car => requireOwnership(req, car))
    // delete Car from mongodb
    .then(car => car.deleteOne())
    // send back 204 and no content if the deletion succeeded
    .then(() => res.sendStatus(204))
    // if an error occurs, pass it to the handler
    .catch(next)
})

module.exports = router
