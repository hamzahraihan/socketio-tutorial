class Person {
	name: string;
	age: number;
	constructor(name: string, age: number) {
		this.name = name;
		this.age = age;
	}

	getName(): string {
		return this.name;
	}
}

let personNamedJohn = new Person("John", 20);

let cena = personNamedJohn;
console.log("cena is becaming ", cena.getName());
personNamedJohn = new Person("Brock lesnar", 23);

console.log(
	"personNamedJohn is becaming new person named ",
	personNamedJohn.getName(),
);
