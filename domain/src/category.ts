import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isAlphaNumericString, isBlankString } from "./utils.js";

export class Category extends Domain {
    public readonly categoryId!: string;
    public readonly name!: string;

    public constructor(protected readonly details: CategoryDetails) {
        super(details);
        this.categoryId = details.categoryId;
        this.name = details.name;
    }

    public validate(): InvalidParametersError | null {
        if (isBlankString(this.details.categoryId)) {
            return new InvalidParametersError("categoryId must not be blank");
        }

        if (isBlankString(this.details.name)) {
            return new InvalidParametersError("name must not be blank");
        }

        return null;
    }
}

export interface CategoryDetails extends DomainDetails {
    categoryId: string;
    name: string;
}

export interface CategoryRepository {
    save(category: Category): Category | Promise<Category>;
    fetchCategoryById(
        categoryId: string,
    ): Category | null | Promise<Category | null>;
}
