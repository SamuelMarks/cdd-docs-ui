export const testYaml = `
openapi: 3.2.0
info:
  title: Full API
  version: 1.0.0
  summary: A summary
  description: A desc
  termsOfService: https://example.com/tos
  contact:
    name: API Support
    url: https://example.com/support
    email: support@example.com
  license:
    name: MIT
    identifier: MIT
    url: https://opensource.org/licenses/MIT
jsonSchemaDialect: https://json-schema.org/draft/2020-12/schema
servers:
  - url: https://api.example.com
    description: Production server
    variables:
      port:
        enum:
          - "443"
          - "8443"
        default: "443"
        description: API port
paths:
  /pets:
    summary: Pet operations
    description: All about pets
    get:
      tags:
        - pets
      summary: List all pets
      description: Returns all pets
      operationId: listPets
      externalDocs:
        url: https://example.com/docs
        description: External docs
      parameters:
        - name: limit
          in: query
          description: How many items to return at one time (max 100)
          required: false
          schema:
            type: integer
            maximum: 100
            minimum: 1
            multipleOf: 1
            exclusiveMaximum: false
            exclusiveMinimum: false
            format: int32
            default: 10
            nullable: true
            readOnly: false
            writeOnly: false
            deprecated: false
            example: 50
            xml:
              name: limit
              namespace: http://example.com/schema
              prefix: ex
              attribute: false
              wrapped: false
            externalDocs:
              url: https://example.com/schema-docs
            allOf:
              - type: integer
            oneOf:
              - type: integer
            anyOf:
              - type: integer
            not:
              type: string
        - $ref: "#/components/parameters/OffsetParam"
      requestBody:
        description: Body desc
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                name:
                  type: string
                  maxLength: 50
                  minLength: 1
                  pattern: "^[a-zA-Z]+$"
                age:
                  type: integer
              required:
                - name
              additionalProperties: false
              maxProperties: 10
              minProperties: 1
              discriminator:
                propertyName: type
                mapping:
                  dog: "#/components/schemas/Dog"
            example:
              name: Fido
            examples:
              fido:
                summary: Fido example
                description: Fido desc
                value: { name: "Fido" }
                externalValue: https://example.com/fido
            encoding:
              history:
                contentType: application/json
                headers:
                  X-Rate-Limit-Limit:
                    description: The number of allowed requests in the current period
                    schema:
                      type: integer
                style: form
                explode: true
                allowReserved: false
      responses:
        "200":
          description: A paged array of pets
          headers:
            x-next:
              description: A link to the next page of responses
              schema:
                type: string
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: "#/components/schemas/Pet"
                maxItems: 100
                minItems: 0
                uniqueItems: true
          links:
            PetById:
              operationId: getPetById
              parameters:
                petId: $response.body#/id
              description: The id value returned in the response
              server:
                url: https://api.example.com
        "500":
          $ref: "#/components/responses/ErrorResponse"
        default:
          description: unexpected error
      callbacks:
        onData:
          "{$request.query.callbackUrl}":
            post:
              requestBody:
                description: Callback payload
                content:
                  application/json:
                    schema:
                      $ref: "#/components/schemas/Pet"
              responses:
                "200":
                  description: callback successfully processed
      deprecated: true
      security:
        - petstore_auth:
            - write:pets
            - read:pets
      servers:
        - url: https://api.example.com/v1
    put:
      operationId: putPets
    post:
      operationId: postPets
    delete:
      operationId: deletePets
    options:
      operationId: optionsPets
    head:
      operationId: headPets
    patch:
      operationId: patchPets
    trace:
      operationId: tracePets
webhooks:
  newPet:
    $ref: "#/components/pathItems/NewPet"
components:
  schemas:
    Pet:
      type: object
      required:
        - id
        - name
      properties:
        id:
          type: integer
          format: int64
        name:
          type: string
        tag:
          type: string
  responses:
    ErrorResponse:
      description: A generic error response
      content:
        application/json:
          schema:
            type: object
            required:
              - message
            properties:
              message:
                type: string
  parameters:
    OffsetParam:
      name: offset
      in: query
      description: The number of items to skip before starting to collect the result set
      required: false
      allowEmptyValue: true
      style: form
      explode: false
      allowReserved: true
      schema:
        type: integer
  examples:
    CatExample:
      summary: A cat
      value:
        id: 1
        name: Fluffy
  requestBodies:
    PetBody:
      description: A pet object
      content:
        application/json:
          schema:
            $ref: "#/components/schemas/Pet"
  headers:
    X-Rate-Limit-Limit:
      description: The number of allowed requests in the current period
      schema:
        type: integer
  securitySchemes:
    petstore_auth:
      type: oauth2
      description: OAuth2 security scheme
      name: Authorization
      in: header
      scheme: bearer
      bearerFormat: JWT
      openIdConnectUrl: https://example.com/oidc
      flows:
        implicit:
          authorizationUrl: https://example.com/api/oauth/dialog
          scopes:
            write:pets: modify pets in your account
            read:pets: read your pets
        password:
          tokenUrl: https://example.com/api/oauth/token
          scopes: {}
        clientCredentials:
          tokenUrl: https://example.com/api/oauth/token
          scopes: {}
        authorizationCode:
          authorizationUrl: https://example.com/api/oauth/dialog
          tokenUrl: https://example.com/api/oauth/token
          refreshUrl: https://example.com/api/oauth/refresh
          scopes: {}
  links:
    PetLink:
      operationRef: "#/paths/~1pets/get"
  callbacks:
    PetCallback:
      "{$request.query.callbackUrl}":
        $ref: "#/components/pathItems/NewPet"
  pathItems:
    NewPet:
      post:
        operationId: newPet
security:
  - petstore_auth:
      - write:pets
tags:
  - name: pets
    description: Pets operations
    externalDocs:
      url: https://example.com/pets
      description: Pets docs
externalDocs:
  url: https://example.com/docs
  description: API documentation
`;