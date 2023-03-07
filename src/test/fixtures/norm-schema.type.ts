
  import { z } from "zod";
  
  export type DbSchema = {
    "public": {
      "city": {
      id: number;
name: string;
countrycode: string;
district: string;
population: number;
    },"country": {
      code: string;
name: string;
continent: string;
region: string;
surfacearea: number;
indepyear?: number | null;
population: number;
lifeexpectancy?: number | null;
gnp?: string | null;
gnpold?: string | null;
localname: string;
governmentform: string;
headofstate?: string | null;
capital?: number | null;
code2: string;
    },"countrylanguage": {
      countrycode: string;
language: string;
isofficial: boolean;
percentage: number;
    }
    }
  };
  