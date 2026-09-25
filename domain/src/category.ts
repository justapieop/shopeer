import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isAlphaNumericString, isBlankString } from "./utils.js";

class category extends Domain {
    public readonly categoryID!: string;
    public readonly name!: string;

    public constructor(protected readonly details: CategoryDetails) {
        super(details);
        this.categoryID = details.categoryID;
        this.name = details.name;
    }

    public validate(): InvalidParametersError | null {
        if (isBlankString(this.details.categoryID)) {
            return new InvalidParametersError("categoryID must not be blank");
        }

        if (isBlankString(this.details.name)) {
            return new InvalidParametersError("name must not be blank");
        }

        return null;
    }
}

export interface CategoryDetails extends DomainDetails {
    categoryID: string;
    name: string;
}

export interface CategoryRepository {
    save(category: category): category | Promise<category>;
    fetchCategoryById(
        categoryID: string,
    ): category | null | Promise<category | null>;
}
