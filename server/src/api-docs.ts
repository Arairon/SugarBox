import swaggerJsdoc from "swagger-jsdoc";
import YAML from "yamljs";

const swaggerDocument = YAML.load("swagger.yml");

const options = {
  definition: swaggerDocument,
  apis: [],
};

export const apispecs = swaggerJsdoc(options);
